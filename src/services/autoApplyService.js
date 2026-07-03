const { resolveResumeForAutoApply } = require("./resolveResumeForAutoApply");
const { createJDWithParsedData } = require("../models/jdModel");
const { createApplication, findRecentDuplicate } = require("../models/applicationModel");
const { parseJobDescription } = require("./jdParseService");
const { computeMatch } = require("./matchingService");
const { generateApplicationEmail } = require("./emailService");
const { buildEmailGenerationContext } = require("./emailContextBuilder");
const { requestApplicationSend } = require("./sendDispatchService");
const { logInfo, logError } = require("../utils/logger");
const { pool } = require("../db");

/**
 * Main auto-apply orchestration function.
 */
const autoApply = async (userId, jobDescriptionText, reqId) => {
  logInfo("AUTO_APPLY_STARTED", { reqId, userId });

  // Phase 1 — External Calls (No DB Tx)
  
  // 1. Resolve latest parsed resume for the user
  let resume;
  try {
    resume = await resolveResumeForAutoApply(userId);
  } catch (err) {
    if (err.code === "RESUME_REQUIRED") {
      const wrapped = new Error("No resume configured.");
      wrapped.code = "DEFAULTS_NOT_CONFIGURED";
      throw wrapped;
    }
    throw err;
  }
  const resumeId = resume.resumeId;

  // 3. Verify SMTP credentials exist
  const { rows: credRows } = await pool.query(
    `SELECT 1 FROM user_email_credentials WHERE user_id = $1`,
    [userId]
  );
  if (credRows.length === 0) {
    const err = new Error("No SMTP credentials saved.");
    err.code = "NO_CREDENTIALS";
    throw err;
  }

  // 4. Parse Job Description
  let parsedJd;
  try {
    parsedJd = await parseJobDescription(jobDescriptionText, userId, {
      reqId,
      resumeSkills: resume.parsedJson?.skills || [],
    });
    logInfo("JD_PARSED", { reqId, userId });
  } catch (error) {
    error.stage = "jd_parse";
    throw error;
  }

  // TODO [LLM-TIMEOUT]: parseJobDescription() and generateApplicationEmail() should
  // be wrapped with explicit request timeouts (e.g. AbortController).

  // Normalize for dedup
  const jobTitle = (parsedJd.job_title || "").toLowerCase().trim();
  const company = (parsedJd.company_name || "").toLowerCase().trim();
  const contactEmail = parsedJd.contact_email;

  // 5. Dedup check (24h window)
  if (contactEmail) {
    const duplicate = await findRecentDuplicate(userId, contactEmail, jobTitle, company);
    if (duplicate) {
      logInfo("APPLICATION_DEDUP_HIT", { reqId, userId, applicationId: duplicate.id });
      const err = new Error("Duplicate application found within 24 hours.");
      err.code = "DUPLICATE_APPLICATION";
      throw err;
    }
  }

  // 6. Compute match
  const matchResult = computeMatch(resume.parsedJson, parsedJd);
  const candidateName = resume.parsedJson?.name || null;

  // 7. Generate personalized email
  const applicationId = require("crypto").randomUUID();
  let cachedEmail;
  try {
    const emailContext = buildEmailGenerationContext({
      rawJdText: jobDescriptionText,
      parsedJd,
      resumeParsedJson: resume.parsedJson,
      matchResult,
    });

    cachedEmail = await generateApplicationEmail(emailContext, {
      reqId,
      userId,
      applicationId,
      resumeId,
      jobDescriptionId: "auto",
    });
    logInfo("EMAIL_GENERATED", { reqId, userId });
  } catch (error) {
    error.stage = "email_generation";
    throw error;
  }

  // Phase 2 — Short DB Tx (Inserts only)
  
  const { withPgClient, markClientInTransaction } = require("../db/pgClient");
  let appRecord;
  let jdRecordId;

  await withPgClient(pool, async (client) => {
  try {
    await client.query("BEGIN");
    markClientInTransaction(client);
    await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");

    // Insert JD
    // createJDWithParsedData(title, text, parsedData, userId, client)
    const jdResult = await createJDWithParsedData(
      parsedJd.job_title || null,
      jobDescriptionText,
      parsedJd,
      userId,
      client
    );
    jdRecordId = jdResult.jobDescriptionId;

    const emailStatus = contactEmail ? "queued" : "needs_review";

    // Insert Application
    appRecord = await createApplication({
      id: applicationId,
      resumeId,
      jobDescriptionId: jdRecordId,
      matchScore: matchResult.score,
      emailSubject: cachedEmail.subject,
      emailBody: cachedEmail.body,
      userId,
      client,
      emailStatus,
      recipientEmail: contactEmail || null,
      resumeSnapshotPath: resume.filePath,
      normalizedJobTitle: jobTitle,
      normalizedCompanyName: company,
      parsedJdSnapshot: {
        job_title: parsedJd.job_title,
        company_name: parsedJd.company_name,
        location: parsedJd.location,
        job_type: parsedJd.job_type,
        skills: parsedJd.skills,
        contact_email: parsedJd.contact_email,
        roles: parsedJd.roles,
        parseOutcome: parsedJd.parseOutcome,
        parseConfidence: parsedJd.parseConfidence,
      },
      parsedResumeSnapshot: {
        name: resume.parsedJson?.name,
        email: resume.parsedJson?.email,
        skills: (resume.parsedJson?.skills || []).slice(0, 20),
        experience_count: (resume.parsedJson?.experience || []).length,
        education_count: (resume.parsedJson?.education || []).length
      },
      matchScoreSnapshot: matchResult.score,
      emailMetadata: cachedEmail.emailMetadata,
      emailFeedbackSignals: cachedEmail.emailFeedbackSignals,
    });

    // TODO [RESUME-CHECKSUM]: Add resume_snapshot_hash and resume_snapshot_version
    // in the future for audit consistency.

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  });

  // Phase 3 — Queue Enqueue (Outside Tx)
  
  if (!contactEmail) {
    logInfo("APPLICATION_NEEDS_REVIEW", { reqId, userId, applicationId });
    return {
      success: true,
      status: "needs_review",
      applicationId,
      reason: "No contact email found in job description."
    };
  }

  try {
    const sendResult = await requestApplicationSend({
      applicationId,
      userId,
      recipientEmail: contactEmail,
    });
    logInfo("APPLICATION_QUEUED", { reqId, userId, applicationId, sendResult });

    return {
      success: true,
      status: sendResult.queued ? "queued_sending" : "queued",
      applicationId,
      ...sendResult,
    };
  } catch (err) {
    logError("QUEUE_ENQUEUE_FAILED", err, { reqId, userId, applicationId });
    
    // Mark failed (status must be 'queued' or 'processing' for this CAS)
    const { markFailed } = require("../models/applicationModel");
    try {
      await markFailed(applicationId, err.message, "queue_enqueue", userId);
    } catch (dbErr) {
      logError("MARK_FAILED_ERROR", dbErr, { reqId, applicationId });
    }
    
    const error = new Error("Failed to enqueue application job.");
    error.code = "QUEUE_FAILED";
    throw error;
  }
};

module.exports = {
  autoApply
};
