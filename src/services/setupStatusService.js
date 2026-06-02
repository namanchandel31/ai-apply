const { pool } = require("../db");
const { getUserDefaults } = require("../models/userModel");
const { getResumeById } = require("../models/resumeModel");
const aiCredentialModel = require("../models/aiCredentialModel");
const { deriveOnboardingState } = require("./onboardingDerivation");

async function computeHasValidResume(userId) {
  const { rows: resumeRows } = await pool.query(
    `SELECT id FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
    [userId]
  );
  if (resumeRows.length === 0) return false;

  const defaults = await getUserDefaults(userId);
  if (defaults?.defaultResumeId) {
    const defaultParsed = await getResumeById(defaults.defaultResumeId, userId);
    if (defaultParsed?.parsedJson) return true;
  }

  const { rows: parsedRows } = await pool.query(
    `SELECT 1 FROM resumes r
     INNER JOIN parsed_resumes pr ON pr.resume_id = r.id
     WHERE r.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return parsedRows.length > 0;
}

async function buildSetupStatus(userId) {
  const { rows: resumeRows } = await pool.query(
    `SELECT id, file_hash as "fileHash", file_name as "filename", uploaded_at as "uploadedAt"
     FROM resumes
     WHERE user_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [userId]
  );

  const { rows: credRows } = await pool.query(
    `SELECT email FROM user_email_credentials WHERE user_id = $1`,
    [userId]
  );

  const aiChainRows = await aiCredentialModel.listByUser(userId);
  const primaryAi = aiChainRows.find((r) => r.priority === 0) || null;

  const verified = await aiCredentialModel.getVerifiedCredentialForUser(userId);
  const hasVerifiedAiCredential = !!verified;
  const hasValidResume = await computeHasValidResume(userId);

  const hasResume = resumeRows.length > 0;
  const hasEmailSetup = credRows.length > 0;
  const hasAiSetup =
    aiChainRows.length > 0 || !!require("../config").ai.openaiApiKey;

  const onboarding = deriveOnboardingState({
    hasVerifiedAiCredential,
    hasValidResume,
  });

  return {
    hasResume,
    hasValidResume,
    hasEmailSetup,
    hasAiSetup,
    hasVerifiedAiCredential,
    hasValidUserAiCredential: hasVerifiedAiCredential,
    credentialLastValidatedAt: verified?.lastValidatedAt ?? null,
    onboardingRequired: onboarding.onboardingRequired,
    currentOnboardingStep: onboarding.currentOnboardingStep,
    activeResume: hasResume ? resumeRows[0] : null,
    email: hasEmailSetup ? credRows[0].email : null,
    activeAiProvider: primaryAi,
    aiCredentialChain: aiChainRows,
  };
}

async function userHasVerifiedAiCredential(userId) {
  const verified = await aiCredentialModel.getVerifiedCredentialForUser(userId);
  return !!verified;
}

module.exports = {
  buildSetupStatus,
  userHasVerifiedAiCredential,
  computeHasValidResume,
};
