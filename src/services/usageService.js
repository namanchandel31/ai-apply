const usageCounterModel = require("../models/usageCounterModel");
const entitlementService = require("./entitlementService");
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
 * Atomically check then consume. Throws QUOTA_EXCEEDED when over the limit, so
 * the counter never increments past the cap.
 */
async function enforceQuota(userId, featureKey, n = 1, { period } = {}) {
  const limit = await getLimit(userId, featureKey);
  const periodType = resolvePeriod(featureKey, period);
  if (isUnlimited(limit)) {
    const used = await usageCounterModel.consume(userId, featureKey, periodType, n);
    return { allowed: true, unlimited: true, used };
  }
  const current = await usageCounterModel.getUsage(userId, featureKey, periodType);
  if (current + n > Number(limit)) {
    const err = new Error(`Quota exceeded for ${featureKey}`);
    err.code = "QUOTA_EXCEEDED";
    err.feature = featureKey;
    err.limit = Number(limit);
    err.used = current;
    throw err;
  }
  const used = await usageCounterModel.consume(userId, featureKey, periodType, n);
  return { allowed: true, unlimited: false, used, limit: Number(limit) };
}

/** Usage snapshot for all numeric catalog features the user has limits on. */
async function getUsageSummary(userId) {
  const entitlement = await entitlementService.getEntitlement(userId);
  const paywallEnabled = entitlement.paywallEnabled;
  const summary = {};
  for (const [key, raw] of Object.entries(entitlement.entitlements)) {
    if (typeof raw !== "number") continue;
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

module.exports = { checkQuota, consume, enforceQuota, getUsageSummary, isUnlimited };
