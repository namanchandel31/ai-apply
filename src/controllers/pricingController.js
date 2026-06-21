const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");
const planModel = require("../models/planModel");
const settingsService = require("../services/settingsService");
const campaignService = require("../services/campaignService");

/**
 * GET /api/pricing — public. DB-driven plan cards: active plans + price points +
 * marketing features + active campaign badges. Never exposes entitlements.
 */
const getPricingController = async (req, res) => {
  try {
    const settings = await settingsService.getPublicSettings();
    const plans = await planModel.listPlans({ activeOnly: true });
    const userId = req.user?.id || null;

    const result = [];
    for (const plan of plans) {
      const [pricePoints, features] = await Promise.all([
        planModel.listPricePoints(plan.id, { activeOnly: true }),
        planModel.listPlanFeatures(plan.id),
      ]);

      let campaigns = [];
      if (userId) {
        const eligible = await campaignService.listEligibleForUser(userId, plan.id);
        campaigns = eligible.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          trialDays: c.trialDays,
          discountType: c.discountType,
          discountAmount: c.discountAmount,
          code: c.code,
        }));
      }

      result.push({
        slug: plan.slug,
        displayName: plan.displayName,
        description: plan.description,
        popular: plan.popular,
        sortOrder: plan.sortOrder,
        pricePoints: pricePoints.map((p) => ({
          id: p.id,
          label: p.label,
          durationDays: p.durationDays,
          amountPaise: p.amountPaise,
          currency: p.currency,
        })),
        features: features.map((f) => ({ label: f.label, included: f.included })),
        campaigns,
      });
    }

    return ok(res, { paywall: settings, plans: result });
  } catch (err) {
    logError("PRICING_ERROR", err, { reqId: req.requestId });
    return error(res, 500, "Failed to load pricing", ERROR_CODES.INTERNAL_ERROR);
  }
};

/** GET /api/campaigns/active — campaigns the current user is eligible for. */
const getActiveCampaignsController = async (req, res) => {
  try {
    const eligible = await campaignService.listEligibleForUser(req.user.id, null);
    return ok(res, eligible.map((c) => ({
      id: c.id, name: c.name, type: c.type, code: c.code,
      trialDays: c.trialDays, discountType: c.discountType, discountAmount: c.discountAmount,
    })));
  } catch (err) {
    logError("ACTIVE_CAMPAIGNS_ERROR", err, { reqId: req.requestId });
    return error(res, 500, "Failed to load campaigns", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = { getPricingController, getActiveCampaignsController };
