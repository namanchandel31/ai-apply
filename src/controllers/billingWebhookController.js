const { logError, logInfo } = require("../utils/logger");
const billingService = require("../services/billingService");
const subscriptionService = require("../services/subscriptionService");
const paymentModel = require("../models/paymentModel");
const planModel = require("../models/planModel");

/**
 * POST /api/billing/webhook — optional Razorpay webhook (recovery in Phase 1).
 * Requires the raw body (mounted with express.raw). Verifies signature, dedupes
 * via billing_events, and reaches the same idempotent grant as verify-payment.
 */
const razorpayWebhookController = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body; // Buffer (express.raw)
  if (!billingService.hasValidWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, error: "invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, error: "invalid payload" });
  }

  const eventId = req.headers["x-razorpay-event-id"] || event?.id || `${event?.event}:${Date.now()}`;

  try {
    const recorded = await paymentModel.recordBillingEvent({
      razorpayEventId: eventId,
      eventType: event.event,
      payload: event,
    });
    if (!recorded) {
      // Duplicate delivery — already processed.
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (event.event === "order.paid") {
      await handleOrderPaid(event);
    }

    await paymentModel.markBillingEventProcessed(eventId, { status: "processed" });
    return res.status(200).json({ success: true });
  } catch (err) {
    logError("BILLING_WEBHOOK_ERROR", err, { eventId, eventType: event?.event });
    try {
      await paymentModel.markBillingEventProcessed(eventId, { status: "failed", error: err.message });
    } catch { /* ignore */ }
    return res.status(500).json({ success: false });
  }
};

async function handleOrderPaid(event) {
  const orderEntity = event?.payload?.order?.entity;
  const paymentEntity = event?.payload?.payment?.entity;
  if (!orderEntity || !paymentEntity) return;

  const attempt = await paymentModel.getAttemptByOrderId(orderEntity.id);
  if (!attempt) {
    logInfo("WEBHOOK_ORDER_NO_ATTEMPT", { orderId: orderEntity.id });
    return;
  }

  const pricePoint = await planModel.getPricePointById(attempt.price_point_id);
  await subscriptionService.grantAccessPeriod({
    userId: attempt.user_id,
    planId: attempt.plan_id,
    pricePointId: attempt.price_point_id,
    durationDays: pricePoint ? pricePoint.durationDays : 30,
    razorpayOrderId: orderEntity.id,
    razorpayPaymentId: paymentEntity.id,
    amountPaise: attempt.intended_amount_paise,
    currency: pricePoint ? pricePoint.currency : "INR",
    campaignId: attempt.campaign_id,
    discountAmountPaise: attempt.discount_amount_paise,
  });
  await paymentModel.setAttemptStatus(attempt.id, "succeeded");
  logInfo("WEBHOOK_ORDER_PAID_GRANTED", { orderId: orderEntity.id, userId: attempt.user_id });
}

module.exports = { razorpayWebhookController };
