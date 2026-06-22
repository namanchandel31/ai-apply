const usageService = require("./usageService");
const trialLimitService = require("./trialLimitService");
const { FEATURE_KEYS } = require("../constants/featureKeys");
const { logError } = require("../utils/logger");

/**
 * Quota enforcement for application sends only (user-facing).
 * Pre-send: check via trialLimitService. Post-send: consume via referralService.
 */
const LIFETIME = { period: "lifetime" };

const QUOTA_FEATURE_KEYS = Object.freeze({
  RESUME_PARSED: FEATURE_KEYS.QUOTA_RESUMES_PARSED,
  JD_PARSED: FEATURE_KEYS.QUOTA_JDS_PARSED,
  EMAIL_GENERATED: FEATURE_KEYS.QUOTA_EMAILS_GENERATED,
  APPLICATION_SENT: FEATURE_KEYS.QUOTA_APPLICATIONS_SENT,
});

/** Non-consuming pre-gate before queueing sends. */
async function check(userId, featureKey) {
  if (!userId) return { allowed: true, skipped: true };
  if (featureKey === QUOTA_FEATURE_KEYS.APPLICATION_SENT) {
    return trialLimitService.checkApplicationQuota(userId);
  }
  return usageService.checkQuota(userId, featureKey, LIFETIME);
}

module.exports = { QUOTA_FEATURE_KEYS, check };
