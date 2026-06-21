const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError, logInfo } = require("../utils/logger");
const { sendError } = require("../utils/httpErrorResponse");
const billingService = require("../services/billingService");
const settingsService = require("../services/settingsService");
const campaignService = require("../services/campaignService");
const subscriptionService = require("../services/subscriptionService");
const entitlementService = require("../services/entitlementService");
const planModel = require("../models/planModel");
const campaignModel = require("../models/campaignModel");
const paymentModel = require("../models/paymentModel");
const { setUserSubscriptionActive } = require("../models/userModel");
const { buildUserMeResponse } = require("../services/userMeService");

function billingDisabled(res) {
  return sendError(res, {
    status: 403,
    code: "BILLING_DISABLED",
    message: "Billing is disabled",
    retryable: false,
  });
}

/**
 * POST /api/checkout/create
 * Body: { planSlug, pricePointId?, campaignCode? }
 * Resolves the plan + price point, applies any discount campaign, creates a
 * Razorpay Order, records a payment_attempt, and returns checkout params.
 */
const createCheckoutController = async (req, res) => {
  const userId = req.user.id;
  if (!(await settingsService.isPaywallEnabled())) return billingDisabled(res);
  if (!(await settingsService.get("checkout_enabled"))) {
    return sendError(res, { status: 403, code: "CHECKOUT_DISABLED", message: "Checkout is disabled", retryable: false });
  }
  if (!billingService.isEnabled()) {
    return sendError(res, { status: 503, code: "BILLING_UNAVAILABLE", message: "Billing is not configured", retryable: false });
  }

  const { planSlug, pricePointId, campaignCode } = req.body || {};
  try {
    const plan = await planModel.getPlanBySlug(planSlug);
    if (!plan || !plan.isActive || plan.isArchived) {
      return error(res, 400, "Invalid plan selected", ERROR_CODES.BAD_REQUEST);
    }

    const pricePoints = await planModel.listPricePoints(plan.id, { activeOnly: true });
    const pricePoint = pricePointId
      ? pricePoints.find((p) => p.id === pricePointId)
      : pricePoints[0];
    if (!pricePoint) {
      return error(res, 400, "No price point available for this plan", ERROR_CODES.BAD_REQUEST);
    }

    // Optional discount campaign.
    let campaign = null;
    let discountPaise = 0;
    if (campaignCode) {
      campaign = await campaignModel.getByCode(campaignCode);
      const { eligible } = await campaignService.evaluate(userId, plan.id, campaign);
      if (eligible && campaign.type === "discount") {
        discountPaise = campaignService.computeDiscountPaise(campaign, pricePoint.amountPaise);
      } else {
        campaign = null;
      }
    }

    const amountPaise = Math.max(100, pricePoint.amountPaise - discountPaise);

    const order = await billingService.createOrder({
      amountPaise,
      currency: pricePoint.currency,
      userId,
      notes: { planSlug: plan.slug, pricePointId: pricePoint.id },
    });

    await paymentModel.createAttempt({
      userId,
      planId: plan.id,
      pricePointId: pricePoint.id,
      campaignId: campaign ? campaign.id : null,
      intendedAmountPaise: amountPaise,
      discountAmountPaise: discountPaise,
      razorpayOrderId: order.id,
    });

    logInfo("CHECKOUT_ORDER_CREATED", { userId, reqId: req.requestId, planSlug: plan.slug, orderId: order.id, amountPaise });

    return ok(res, {
      orderId: order.id,
      amountPaise,
      currency: pricePoint.currency,
      keyId: billingService.getKeyId(),
      plan: { slug: plan.slug, displayName: plan.displayName },
    });
  } catch (err) {
    if (err.code === "BILLING_UNAVAILABLE") {
      return sendError(res, { status: 503, code: "BILLING_UNAVAILABLE", message: "Billing is not configured", retryable: false });
    }
    logError("CHECKOUT_CREATE_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to create checkout", ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * POST /api/billing/verify-payment
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * Plan/amount come from the stored payment_attempt (never the client). Idempotent
 * grant of the access period.
 */
const verifyBillingPaymentController = async (req, res) => {
  const userId = req.user.id;
  if (!(await settingsService.isPaywallEnabled())) return billingDisabled(res);

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return error(res, 400, "Invalid payment verification payload", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const attempt = await paymentModel.getAttemptByOrderId(razorpayOrderId);
    if (!attempt || attempt.user_id !== userId) {
      return sendError(res, { status: 404, code: ERROR_CODES.NOT_FOUND, message: "Payment order not found", retryable: false });
    }

    if (!billingService.hasValidPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
      return sendError(res, { status: 400, code: "INVALID_PAYMENT_SIGNATURE", message: "Payment verification failed", retryable: false });
    }

    const pricePoint = await planModel.getPricePointById(attempt.price_point_id);
    const durationDays = pricePoint ? pricePoint.durationDays : 30;

    const { subscription, idempotent } = await subscriptionService.grantAccessPeriod({
      userId,
      planId: attempt.plan_id,
      pricePointId: attempt.price_point_id,
      durationDays,
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: attempt.intended_amount_paise,
      currency: pricePoint ? pricePoint.currency : "INR",
      campaignId: attempt.campaign_id,
      discountAmountPaise: attempt.discount_amount_paise,
    });

    await paymentModel.setAttemptStatus(attempt.id, "succeeded");

    // Best-effort campaign slot claim (paid discount campaigns).
    if (attempt.campaign_id && !idempotent) {
      try {
        await campaignService.claimSlot(attempt.campaign_id, userId, { subscriptionId: subscription.id });
      } catch (e) {
        logInfo("CHECKOUT_CAMPAIGN_CLAIM_SKIPPED", { userId, campaignId: attempt.campaign_id, reason: e.code });
      }
    }

    // Back-compat: keep legacy users.subscription_* in sync for existing /me consumers.
    const plan = await planModel.getPlanById(attempt.plan_id);
    try {
      await setUserSubscriptionActive(userId, {
        subscriptionTier: plan ? plan.slug : "managed",
        planId: plan ? plan.slug : null,
        razorpayOrderId,
        razorpayPaymentId,
      });
    } catch (e) {
      logError("LEGACY_SUBSCRIPTION_SYNC_FAILED", e, { userId });
    }

    const [me, entitlement] = await Promise.all([
      buildUserMeResponse(userId),
      entitlementService.getEntitlement(userId),
    ]);

    logInfo("BILLING_PAYMENT_VERIFIED", { userId, reqId: req.requestId, orderId: razorpayOrderId, paymentId: razorpayPaymentId, idempotent });
    return ok(res, { user: me, entitlement }, { idempotent });
  } catch (err) {
    logError("BILLING_VERIFY_PAYMENT_ERROR", err, { userId, reqId: req.requestId, orderId: razorpayOrderId });
    return error(res, 500, "Failed to verify payment", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  createCheckoutController,
  verifyBillingPaymentController,
};
