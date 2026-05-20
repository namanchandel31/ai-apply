const { getUserDefaults } = require("../models/userModel");
const { getResumeById, getLatestParsedResumeForUser } = require("../models/resumeModel");

/**
 * Resolve a parsed, user-owned resume for auto-apply.
 * Order: explicit resumeId → default_resume_id → latest parsed resume.
 */
async function resolveResumeForAutoApply(userId, explicitResumeId = null) {
  let resumeId =
    explicitResumeId != null && String(explicitResumeId).trim()
      ? String(explicitResumeId).trim()
      : null;

  if (!resumeId) {
    const defaults = await getUserDefaults(userId);
    resumeId = defaults?.defaultResumeId ?? null;
  }

  if (!resumeId) {
    const latest = await getLatestParsedResumeForUser(userId);
    resumeId = latest?.resumeId ?? null;
  }

  if (!resumeId) {
    const err = new Error("A valid resume is required before auto apply");
    err.code = "RESUME_REQUIRED";
    throw err;
  }

  const resume = await getResumeById(resumeId, userId);
  if (!resume) {
    const err = new Error("Resume not found or not accessible");
    err.code = "RESUME_NOT_FOUND";
    throw err;
  }

  if (!resume.parsedJson) {
    const err = new Error("Resume must be parsed before auto apply");
    err.code = "RESUME_NOT_PARSED";
    throw err;
  }

  return {
    resumeId: resume.resumeId,
    parsedResumeId: resume.parsedResumeId,
    parsedJson: resume.parsedJson,
    filePath: resume.filePath,
  };
}

module.exports = { resolveResumeForAutoApply };
