const { pool } = require("../db");
const { getUserDefaults } = require("../models/userModel");
const { getResumeById } = require("../models/resumeModel");
const aiCredentialModel = require("../models/aiCredentialModel");
const settingsService = require("./settingsService");
const entitlementService = require("./entitlementService");
const onboardingService = require("./onboardingService");
const { getFailedParseByHash } = require("../models/failedParseModel");

function formatResumeParseError(errorMessage) {
  const msg = String(errorMessage || "");
  if (msg.includes("Extraction Failed") || msg.includes("too weak to parse")) {
    return "We couldn't read enough text from this PDF. Try re-exporting it from Word or Google Docs, or upload a standard text-based PDF.";
  }
  if (msg.includes("invalid_parsed_content")) {
    return "We couldn't extract a name, email address, and skills from this resume. Try a clearer PDF or re-export it.";
  }
  if (msg.includes("Schema validation failed")) {
    return "We couldn't parse this resume into a usable format. Try re-exporting the PDF or upload a different version.";
  }
  if (msg.includes("PDF Text Extraction Failed")) {
    return "This PDF couldn't be opened for text extraction. Try re-saving or re-exporting the file.";
  }
  return "Resume parsing failed. Replace your resume in Setup with a text-based PDF.";
}

async function resolveResumeParseStatus(hasResume, hasValidResume, fileHash, uploadedAt = null) {
  if (!hasResume) return { resumeParseStatus: "missing", resumeParseError: null };
  if (hasValidResume) return { resumeParseStatus: "ready", resumeParseError: null };

  if (fileHash) {
    const failed = await getFailedParseByHash(fileHash, "resume");
    if (failed) {
      return {
        resumeParseStatus: "failed",
        resumeParseError: formatResumeParseError(failed.error_message),
      };
    }
  }

  const uploadedMs = uploadedAt ? new Date(uploadedAt).getTime() : NaN;
  const staleMs = 15 * 60 * 1000;
  if (Number.isFinite(uploadedMs) && Date.now() - uploadedMs > staleMs) {
    return {
      resumeParseStatus: "failed",
      resumeParseError:
        "Resume parsing did not complete. Replace your resume in Setup with a text-based PDF exported from Word or Google Docs.",
    };
  }

  return { resumeParseStatus: "processing", resumeParseError: null };
}

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
  const paywallTrigger = await settingsService.getPaywallTrigger();
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

  const { rows: gmailRows } = await pool.query(
    `SELECT email_address AS email FROM email_accounts
     WHERE user_id = $1 AND provider = 'gmail' AND status = 'connected' AND can_send = TRUE
     LIMIT 1`,
    [userId]
  );

  const aiChainRows = await aiCredentialModel.listByUser(userId);
  const primaryAi = aiChainRows.find((r) => r.priority === 0) || null;

  const verified = await aiCredentialModel.getVerifiedCredentialForUser(userId);
  const hasVerifiedAiCredential = !!verified;
  const canUseManagedAi = entitlement.entitlements?.can_use_managed_ai === true;
  const hasValidResume = await computeHasValidResume(userId);

  const hasResume = resumeRows.length > 0;
  const hasEmailSetup = credRows.length > 0 || gmailRows.length > 0;
  const hasAiSetup = aiChainRows.length > 0 || canUseManagedAi;

  const onboarding = await onboardingService.resolveOnboarding(userId, {
    hasVerifiedAiCredential,
    canUseManagedAi,
    hasResume,
    hasValidResume,
    hasEmailSetup,
  });

  const parseState = await resolveResumeParseStatus(
    hasResume,
    hasValidResume,
    resumeRows[0]?.fileHash ?? null,
    resumeRows[0]?.uploadedAt ?? null,
  );

  return {
    pricingEnabled,
    paywallTrigger,
    hasActiveSubscription,
    subscriptionTier,
    planSlug: entitlement.planSlug,
    entitlements: entitlement.entitlements,
    accessEndsAt: entitlement.accessEndsAt,
    subscriptionState: entitlement.status,
    hasResume,
    hasValidResume,
    ...parseState,
    hasEmailSetup,
    hasAiSetup,
    hasVerifiedAiCredential,
    canUseManagedAi,
    hasValidUserAiCredential: hasVerifiedAiCredential,
    credentialLastValidatedAt: verified?.lastValidatedAt ?? null,
    onboardingRequired: onboarding.onboardingRequired,
    currentOnboardingStep: onboarding.currentOnboardingStep,
    activeResume: hasResume ? resumeRows[0] : null,
    email: hasEmailSetup ? credRows[0]?.email ?? gmailRows[0]?.email : null,
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
  formatResumeParseError,
  resolveResumeParseStatus,
};
