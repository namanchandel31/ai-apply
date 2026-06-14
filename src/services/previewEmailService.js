const { resolveResumeForAutoApply } = require("./resolveResumeForAutoApply");
const { parseJobDescription } = require("./jdParseService");
const { computeMatch } = require("./matchingService");
const { generateApplicationEmail } = require("./emailService");
const { buildEmailGenerationContext } = require("./emailContextBuilder");
const { getEmailPreferenceLevels } = require("../models/userModel");
const { logInfo } = require("../utils/logger");

/**
 * Generate a tailored email preview from raw JD text (no persistence).
 */
async function previewApplicationEmail(userId, jobDescriptionText, reqId) {
  logInfo("PREVIEW_EMAIL_STARTED", { reqId, userId });

  const resume = await resolveResumeForAutoApply(userId);

  const parsedJd = await parseJobDescription(jobDescriptionText, userId, {
    reqId,
    resumeSkills: resume.parsedJson?.skills || [],
  });

  const matchResult = computeMatch(resume.parsedJson, parsedJd);

  const prefLevels = (await getEmailPreferenceLevels(userId)) || {
    emailToneLevel: 50,
    emailStructureLevel: 60,
  };

  const emailContext = buildEmailGenerationContext({
    rawJdText: jobDescriptionText,
    parsedJd,
    resumeParsedJson: resume.parsedJson,
    matchResult,
    emailToneLevel: prefLevels.emailToneLevel,
    emailStructureLevel: prefLevels.emailStructureLevel,
  });

  const generated = await generateApplicationEmail(emailContext, {
    reqId,
    userId,
    resumeId: resume.resumeId,
    jobDescriptionId: "preview",
  });

  logInfo("PREVIEW_EMAIL_SUCCESS", { reqId, userId });

  return {
    subject: generated.subject,
    body: generated.body,
    match: {
      score: matchResult.score,
      matchedSkills: matchResult.matchedSkills,
      missingSkills: matchResult.missingSkills,
    },
    jobTitle: parsedJd.job_title ?? null,
    company: parsedJd.company_name ?? null,
    contactEmail: parsedJd.contact_email ?? null,
  };
}

module.exports = { previewApplicationEmail };
