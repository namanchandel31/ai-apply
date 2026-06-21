const usageService = require("./usageService");
const { FEATURE_KEYS } = require("../constants/featureKeys");
const { logError } = require("../utils/logger");

/**
 * Provider-neutral quota enforcement, built entirely on the existing usage_counters /
 * entitlement stack. The four allowances resolve their limits from the catalog
 * (feature_definitions) + plan_entitlements — no business numbers live here — so the same
 * machinery serves free trials, paid tiers, campaigns, and promo credits.
 *
 * Enforcement model: reserve-before-work + release-on-failure.
 *   - `reserve` atomically gates AND counts in one conditional UPDATE (no overshoot under
 *     concurrency). It is called immediately before the expensive/irreversible work.
 *   - `release` is the compensating decrement if that work then fails, so failed actions
 *     never permanently consume a credit. Best-effort; never throws.
 *   - `check` is a cheap, non-consuming pre-gate for fast paywall feedback before queuing
 *     async work. It is advisory only — `reserve` remains the authoritative, race-safe step.
 */
const LIFETIME = { period: "lifetime" };

const QUOTA_FEATURE_KEYS = Object.freeze({
  RESUME_PARSED: FEATURE_KEYS.QUOTA_RESUMES_PARSED,
  JD_PARSED: FEATURE_KEYS.QUOTA_JDS_PARSED,
  EMAIL_GENERATED: FEATURE_KEYS.QUOTA_EMAILS_GENERATED,
  APPLICATION_SENT: FEATURE_KEYS.QUOTA_APPLICATIONS_SENT,
});

/**
 * Atomically reserve one credit before doing work. Throws an error with
 * `code === "QUOTA_EXCEEDED"` (and feature/limit/used/remaining) when the allowance is
 * spent. No-ops for an unauthenticated/legacy caller (no userId).
 */
async function reserve(userId, featureKey) {
  if (!userId) return { allowed: true, skipped: true };
  return usageService.enforceQuota(userId, featureKey, 1, LIFETIME);
}

/** Compensating decrement when a reserved action ultimately fails. Never throws. */
async function release(userId, featureKey) {
  if (!userId) return;
  try {
    await usageService.release(userId, featureKey, 1, LIFETIME);
  } catch (err) {
    logError("QUOTA_RELEASE_FAILED", err, { userId, featureKey });
  }
}

/** Non-consuming pre-gate. Returns the checkQuota shape ({ allowed, limit, used, ... }). */
async function check(userId, featureKey) {
  if (!userId) return { allowed: true, skipped: true };
  return usageService.checkQuota(userId, featureKey, LIFETIME);
}

module.exports = { QUOTA_FEATURE_KEYS, reserve, release, check };
