const { sendError } = require("../utils/httpErrorResponse");
const entitlementService = require("../services/entitlementService");
const paywallService = require("../services/paywallService");
const usageService = require("../services/usageService");
const { logError } = require("../utils/logger");

/**
 * Gate a route on a boolean catalog entitlement (e.g. can_use_byok). Never
 * branches on plan slug — authorization derives purely from the resolved map.
 */
function requireEntitlement(featureKey) {
  return async (req, res, next) => {
    try {
      const allowed = await entitlementService.hasEntitlement(req.user.id, featureKey);
      if (!allowed) {
        return sendError(res, {
          status: 403,
          code: "ENTITLEMENT_REQUIRED",
          message: "Your plan does not include this feature",
          retryable: false,
          meta: { feature: featureKey },
        });
      }
      return next();
    } catch (err) {
      logError("REQUIRE_ENTITLEMENT_ERROR", err, { userId: req.user?.id, feature: featureKey });
      return sendError(res, { status: 500, code: "INTERNAL_ERROR", message: "Entitlement check failed", retryable: true });
    }
  };
}

/**
 * Gate a route behind the configured paywall trigger (e.g. before_first_apply).
 * Lets the action through when the paywall is off or the user is entitled.
 */
function requirePaidAccess(actionKey = "access") {
  return async (req, res, next) => {
    try {
      const { required } = await paywallService.requiresPaymentNow(req.user.id, actionKey);
      if (required) {
        return sendError(res, {
          status: 402,
          code: "PAYMENT_REQUIRED",
          message: "An active plan is required to continue",
          retryable: false,
        });
      }
      return next();
    } catch (err) {
      logError("REQUIRE_PAID_ACCESS_ERROR", err, { userId: req.user?.id, actionKey });
      return sendError(res, { status: 500, code: "INTERNAL_ERROR", message: "Access check failed", retryable: true });
    }
  };
}

/**
 * Pre-check a numeric quota (does NOT consume). Use usageService.enforceQuota /
 * consume at the point the action actually succeeds.
 */
function checkQuota(featureKey) {
  return async (req, res, next) => {
    try {
      const result = await usageService.checkQuota(req.user.id, featureKey);
      if (!result.allowed) {
        return sendError(res, {
          status: 429,
          code: "QUOTA_EXCEEDED",
          message: "You have reached your plan limit for this period",
          retryable: false,
          meta: { feature: featureKey, limit: result.limit, used: result.used },
        });
      }
      return next();
    } catch (err) {
      logError("CHECK_QUOTA_ERROR", err, { userId: req.user?.id, feature: featureKey });
      return sendError(res, { status: 500, code: "INTERNAL_ERROR", message: "Quota check failed", retryable: true });
    }
  };
}

module.exports = { requireEntitlement, requirePaidAccess, checkQuota };
