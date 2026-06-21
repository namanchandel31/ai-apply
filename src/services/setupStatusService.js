const config = require("../config");
const { pool } = require("../db");
const { getUserDefaults } = require("../models/userModel");
const { getResumeById } = require("../models/resumeModel");
const aiCredentialModel = require("../models/aiCredentialModel");
const entitlementService = require("./entitlementService");
const onboardingService = require("./onboardingService");

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
  const { rows: userRows } = await pool.query(
    `SELECT subscription_status, subscription_tier
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  const subscriptionTier = userRows[0]?.subscription_tier ?? "free";

  // Entitlement is the single source of truth. It folds in the ENV kill-switch,
  // the DB paywall_enabled setting, and the user's live access period.
  const entitlement = await entitlementService.getEntitlement(userId);
  const pricingEnabled = entitlement.paywallEnabled;
  const hasActiveSubscription = entitlement.entitled;

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
  const hasAiSetup = aiChainRows.length > 0 || !!config.ai.openaiApiKey;

  const onboarding = await onboardingService.resolveOnboarding(userId, {
    hasVerifiedAiCredential,
    hasValidResume,
    hasEmailSetup,
  });

  return {
    pricingEnabled,
    hasActiveSubscription,
    subscriptionTier,
    planSlug: entitlement.planSlug,
    entitlements: entitlement.entitlements,
    accessEndsAt: entitlement.accessEndsAt,
    subscriptionState: entitlement.status,
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
