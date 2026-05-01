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
const processApplyJob = async (resumeId, jobDescriptionId, reqId) => {
  // 1. Duplicate Pre-check
  const existingApp = await getApplicationByResumeAndJD(resumeId, jobDescriptionId);
  if (existingApp) {
    logInfo("apply_dedup_hit", { reqId, resumeId, jobDescriptionId, applicationId: existingApp.id, status: "success" });
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

  // 2. Fetch dependencies
  const resume = await getResumeById(resumeId);
  if (!resume) throw new Error("Resume not found");
  
  const jd = await getJDById(jobDescriptionId);
  if (!jd) throw new Error("Job Description not found");

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
          { reqId, resumeId, jobDescriptionId }
        );

        logInfo("email_generation_success", { reqId, resumeId, jobDescriptionId, attempt });
      }

      // 5. Persist to DB using ON CONFLICT logic
      const appRecord = await createApplication({
        id: applicationId,
        resumeId,
        jobDescriptionId,
        matchScore: matchResult.score,
        emailSubject: cachedEmail.subject,
        emailBody: cachedEmail.body
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
};

module.exports = {
  processApplyJob
};
