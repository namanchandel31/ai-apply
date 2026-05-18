const crypto = require("crypto");
const { getApplicationByResumeAndJD, createApplication } = require("../models/applicationModel");
const { getResumeById } = require("../models/resumeModel");
const { getJDById } = require("../models/jdModel");
const { computeMatch } = require("./matchingService");
const { generateApplicationEmail, RetryableError } = require("./emailService");
const { logInfo, logError } = require("../utils/logger");

/**
 * Executes a function with a single retry on RetryableError.
 */
const withRetry = async (operation, maxRetries = 1) => {
  let attempt = 1;
  while (attempt <= maxRetries + 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (error instanceof RetryableError && attempt <= maxRetries) {
        attempt++;
        continue;
      }
      throw error;
    }
  }
};

/**
 * Process the application job, coordinating deduplication, matching, email generation, and persistence.
 * 
 * @param {string} resumeId 
 * @param {string} jobDescriptionId 
 * @param {string} reqId 
 * @returns {Promise<Object>}
 */
const processApplyJob = async (resumeId, jobDescriptionId, reqId, userId = null) => {
  const { pool } = require("../db");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");

    // 1. Duplicate Pre-check (with transaction client)
    const existingApp = await getApplicationByResumeAndJD(resumeId, jobDescriptionId, userId, client);
    if (existingApp) {
      logInfo("apply_dedup_hit", { reqId, resumeId, jobDescriptionId, applicationId: existingApp.id, status: "success" });
      await client.query("COMMIT");
      return {
        applicationId: existingApp.id,
        match: {
          score: existingApp.match_score,
          matchedSkills: [], // Omitted from DB for now, or re-computed if necessary
          missingSkills: []
        },
        email: {
          subject: existingApp.email_subject,
          body: existingApp.email_body
        }
      };
    }

    // 2. Fetch dependencies (with transaction client and user ownership check)
    const resume = await getResumeById(resumeId, userId, client);
    if (!resume) {
      await client.query("ROLLBACK");
      const error = new Error("Resume not found");
      error.code = "NOT_FOUND";
      throw error;
    }
    
    const jd = await getJDById(jobDescriptionId, userId, client);
    if (!jd) {
      await client.query("ROLLBACK");
      const error = new Error("Job Description not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    // 3. Compute Match natively
    const matchResult = computeMatch(resume.parsedJson, jd.parsedJson);
    logInfo("match_computed", { reqId, resumeId, jobDescriptionId, score: matchResult.score });

    const candidateName = resume.parsedJson?.name || null;
    const jobTitle = jd.parsedJson?.job_title || null;

    const applicationId = crypto.randomUUID();
    let cachedEmail = null;

    // 4. Resilient Generation Loop
    const savedApp = await withRetry(async (attempt) => {
      try {
        // Only call LLM if we haven't successfully generated the email yet in a prior attempt
        if (!cachedEmail) {
          logInfo("email_generation_start", { reqId, resumeId, jobDescriptionId, attempt });
          
          cachedEmail = await generateApplicationEmail(
            candidateName,
            jobTitle,
            matchResult.matchedSkills,
            matchResult.score,
            { reqId, userId, resumeId, jobDescriptionId }
          );

          logInfo("email_generation_success", { reqId, resumeId, jobDescriptionId, attempt });
        }

        // 5. Persist to DB using ON CONFLICT logic (with transaction client)
        const appRecord = await createApplication({
          id: applicationId,
          resumeId,
          jobDescriptionId,
          matchScore: matchResult.score,
          emailSubject: cachedEmail.subject,
          emailBody: cachedEmail.body,
          userId,
          client
        });

        logInfo("application_saved", { reqId, resumeId, jobDescriptionId, applicationId: appRecord.id });
        return appRecord;

      } catch (error) {
        if (error.name !== "RetryableError" && error.name !== "NonRetryableError") {
          logError("email_generation", error, { reqId, resumeId, jobDescriptionId, error_type: error.name, error_message: error.message });
        } else {
          logError("email_generation", error, { reqId, resumeId, jobDescriptionId, error_type: error.name, error_message: error.message, status: "retry" });
        }
        throw error;
      }
    });

    await client.query("COMMIT");

    return {
      applicationId: savedApp.id,
      match: {
        score: matchResult.score,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills
      },
      email: {
        subject: savedApp.email_subject,
        body: savedApp.email_body
      }
    };

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  processApplyJob
};
