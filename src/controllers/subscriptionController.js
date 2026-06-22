const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const { sendError } = require("../utils/httpErrorResponse");
const entitlementService = require("../services/entitlementService");
const paywallService = require("../services/paywallService");
const settingsService = require("../services/settingsService");
const usageService = require("../services/usageService");
const subscriptionService = require("../services/subscriptionService");
const subscriptionModel = require("../models/subscriptionModel");
const campaignService = require("../services/campaignService");
const planComparisonService = require("../services/planComparisonService");
const planModel = require("../models/planModel");

/** GET /api/subscription/status */
const getSubscriptionStatusController = async (req, res) => {
  const userId = req.user.id;
  try {
    const [entitlement, usage, paywallTrigger, nextAction, live] = await Promise.all([
      entitlementService.getEntitlement(userId),
      usageService.getUsageSummary(userId),
      settingsService.getPaywallTrigger(),
      paywallService.nextPaywallAction(userId),
      subscriptionModel.getLiveSubscription(userId),
    ]);

    let planDisplayName = null;
    if (live?.planId) {
      planDisplayName = (await planModel.getPlanById(live.planId))?.displayName ?? null;
    }

    return ok(res, {
      entitled: entitlement.entitled,
      paywallEnabled: entitlement.paywallEnabled,
      planSlug: entitlement.planSlug,
      status: entitlement.status,
      accessEndsAt: entitlement.accessEndsAt,
      entitlements: entitlement.entitlements,
      usage,
      paywallTrigger,
      nextPaywallAction: nextAction,
      subscription: live
        ? {
            id: live.id,
            status: live.status,
            source: live.source,
            planSlug: entitlement.planSlug,
            planDisplayName,
            accessStartsAt: live.accessStartsAt,
            accessEndsAt: live.accessEndsAt,
            cancelAtPeriodEnd: Boolean(live.cancelAtPeriodEnd),
          }
        : null,
    });
  } catch (err) {
    logError("SUBSCRIPTION_STATUS_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to load subscription status", ERROR_CODES.INTERNAL_ERROR);
  }
};

/** GET /api/usage */
const getUsageController = async (req, res) => {
  const userId = req.user.id;
  try {
    return ok(res, await usageService.getUsageSummary(userId));
  } catch (err) {
    logError("USAGE_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to load usage", ERROR_CODES.INTERNAL_ERROR);
  }
};

/** GET /api/plans/compare?to=:planSlug */
const compareForUserController = async (req, res) => {
  const userId = req.user.id;
  try {
    const toPlan = await planModel.getPlanBySlug(req.query.to);
    if (!toPlan) return error(res, 400, "Unknown target plan", ERROR_CODES.BAD_REQUEST);
    const entitlement = await entitlementService.getEntitlement(userId);
    const diff = await planComparisonService.compare(entitlement.planId, toPlan.id);
    return ok(res, diff);
  } catch (err) {
    logError("PLAN_COMPARE_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to compare plans", ERROR_CODES.INTERNAL_ERROR);
  }
};

/** POST /api/trials/claim  Body: { campaignCode, planSlug } */
const claimTrialController = async (req, res) => {
  const userId = req.user.id;
  const { campaignCode, planSlug } = req.body || {};
  if (!campaignCode || !planSlug) {
    return error(res, 400, "campaignCode and planSlug are required", ERROR_CODES.BAD_REQUEST);
  }
  try {
    const plan = await planModel.getPlanBySlug(planSlug);
    if (!plan) return error(res, 400, "Unknown plan", ERROR_CODES.BAD_REQUEST);
    const subscription = await campaignService.claimTrial({ userId, campaignCode, planId: plan.id });
    const entitlement = await entitlementService.getEntitlement(userId);
    return ok(res, { subscription, entitlement });
  } catch (err) {
    if (err.code === "CAMPAIGN_INELIGIBLE" || err.code === "CAMPAIGN_NOT_TRIAL") {
      return sendError(res, { status: 409, code: err.code, message: err.message, retryable: false });
    }
    if (err.code === "CAMPAIGN_FULL" || err.code === "CAMPAIGN_ALREADY_CLAIMED") {
      return sendError(res, { status: 409, code: err.code, message: err.message, retryable: false });
    }
    logError("TRIAL_CLAIM_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to claim trial", ERROR_CODES.INTERNAL_ERROR);
  }
};

/** POST /api/subscription/cancel  Body: { immediate? } */
const cancelSubscriptionController = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await subscriptionService.cancel({ userId, immediate: Boolean(req.body?.immediate) });
    return ok(res, { subscription: result });
  } catch (err) {
    logError("SUBSCRIPTION_CANCEL_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to cancel subscription", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getSubscriptionStatusController,
  getUsageController,
  compareForUserController,
  claimTrialController,
  cancelSubscriptionController,
};
