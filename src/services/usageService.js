const usageCounterModel = require("../models/usageCounterModel");
const entitlementService = require("./entitlementService");
const settingsService = require("./settingsService");
const { periodTypeForFeatureKey } = require("../constants/featureKeys");

/**
 * Generic, feature-agnostic quota tracking over usage_counters.
 * A numeric catalog feature (e.g. monthly_application_limit) shares its key with
 * the usage counter; the period is derived from the key prefix.
 *
 * Limit semantics: a limit of -1 (or null/undefined) means unlimited.
 */

function resolvePeriod(featureKey, explicitPeriod) {
  return explicitPeriod || periodTypeForFeatureKey(featureKey) || "monthly";
}

function isUnlimited(limit) {
  return limit === null || limit === undefined || Number(limit) < 0;
}

/**
 * Returns the numeric limit for a feature, or -1 (unlimited) when the paywall is
 * disabled — so quotas never block while monetization is off.
 */
async function getLimit(userId, featureKey) {
  const ent = await entitlementService.getEntitlement(userId);
  if (!ent.paywallEnabled) return -1;
  // Time-based trials use access windows, not action quotas.
  if (featureKey.startsWith("quota_") && (await settingsService.getTrialMode()) === "time") {
    return -1;
  }
  return ent.entitlements[featureKey];
}

async function checkQuota(userId, featureKey, { period } = {}) {
  const limit = await getLimit(userId, featureKey);
  const periodType = resolvePeriod(featureKey, period);
  if (isUnlimited(limit)) {
    return { allowed: true, unlimited: true, limit: -1, used: 0, remaining: Infinity, periodType };
  }
  const used = await usageCounterModel.getUsage(userId, featureKey, periodType);
  const remaining = Math.max(0, Number(limit) - used);
  return { allowed: used < Number(limit), unlimited: false, limit: Number(limit), used, remaining, periodType };
}

async function consume(userId, featureKey, n = 1, { period } = {}) {
  const periodType = resolvePeriod(featureKey, period);
  return usageCounterModel.consume(userId, featureKey, periodType, n);
}

/**
 * Atomically increments only if it stays within the limit, otherwise throws
 * QUOTA_EXCEEDED. A single conditional UPDATE replaces the old check-then-act, so
 * concurrent callers can never overshoot the cap.
 */
async function enforceQuota(userId, featureKey, n = 1, { period } = {}) {
  const limit = await getLimit(userId, featureKey);
  const periodType = resolvePeriod(featureKey, period);
  if (isUnlimited(limit)) {
    const used = await usageCounterModel.consume(userId, featureKey, periodType, n);
    return { allowed: true, unlimited: true, used };
  }
  const numericLimit = Number(limit);
  const used = await usageCounterModel.consumeIfWithinLimit(
    userId,
    featureKey,
    periodType,
    n,
    numericLimit
  );
  if (used === null) {
    const current = await usageCounterModel.getUsage(userId, featureKey, periodType);
    const err = new Error(`Quota exceeded for ${featureKey}`);
    err.code = "QUOTA_EXCEEDED";
    err.feature = featureKey;
    err.limit = numericLimit;
    err.used = current;
    err.remaining = Math.max(0, numericLimit - current);
    // Reaching this branch implies a finite limit, which only happens when the paywall
    // is on — so an upgrade to a higher plan would lift the cap.
    err.upgradeEligible = true;
    throw err;
  }
  return { allowed: true, unlimited: false, used, limit: numericLimit };
}

/**
 * Compensating decrement for a previously reserved credit (see enforceQuota). Floors at
 * zero so a double release can't drive the counter negative.
 */
async function release(userId, featureKey, n = 1, { period } = {}) {
  const periodType = resolvePeriod(featureKey, period);
  return usageCounterModel.release(userId, featureKey, periodType, n);
}

/** Usage snapshot for all numeric catalog features the user has limits on. */
async function getUsageSummary(userId) {
  const entitlement = await entitlementService.getEntitlement(userId);
  const paywallEnabled = entitlement.paywallEnabled;
  const trialMode = await settingsService.getTrialMode();
  const summary = {};
  for (const [key, raw] of Object.entries(entitlement.entitlements)) {
    if (typeof raw !== "number") continue;
    if (key.startsWith("quota_") && trialMode === "time") continue;
    const value = paywallEnabled ? raw : -1;
    const periodType = resolvePeriod(key);
    if (isUnlimited(value)) {
      summary[key] = { limit: -1, used: 0, remaining: -1, periodType, unlimited: true };
    } else {
      const used = await usageCounterModel.getUsage(userId, key, periodType);
      summary[key] = { limit: value, used, remaining: Math.max(0, value - used), periodType, unlimited: false };
    }
  }
  return summary;
}

module.exports = { checkQuota, consume, enforceQuota, release, getUsageSummary, isUnlimited };
