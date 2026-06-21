/**
 * Platform-standard paywall response for an exhausted numeric quota. Every credit-gated
 * entry point returns this exact shape so the client can render a paywall, show the
 * remaining count, and route to pricing without an extra round-trip.
 *
 * HTTP 402 (Payment Required) is used deliberately — it signals "upgrade to continue",
 * distinct from 429 (slow down / rate limited).
 */
const QUOTA_CODE = "QUOTA_EXCEEDED";

/** True for the error thrown by usageService.enforceQuota / quotaService.reserve. */
function isQuotaError(err) {
  return Boolean(err) && err.code === QUOTA_CODE;
}

/** Normalize an enforce error OR a checkQuota result (+feature) into the response meta. */
function quotaMeta(source) {
  const feature = source.feature;
  const limit = Number(source.limit ?? 0);
  const used = Number(source.used ?? 0);
  const remaining =
    source.remaining != null ? Number(source.remaining) : Math.max(0, limit - used);
  return {
    feature,
    limit,
    used,
    remaining,
    // Finite quotas are only enforced while the paywall is on, so an upgrade always lifts it.
    upgradeEligible: source.upgradeEligible !== false,
    paywall: true,
  };
}

function sendQuotaExceeded(res, source) {
  const meta = quotaMeta(source);
  return res.status(402).json({
    success: false,
    error: {
      code: QUOTA_CODE,
      message: source.message || `You've reached your plan limit for ${meta.feature}.`,
      retryable: false,
      meta,
    },
  });
}

module.exports = { QUOTA_CODE, isQuotaError, quotaMeta, sendQuotaExceeded };
