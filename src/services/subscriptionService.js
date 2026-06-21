const { pool } = require("../db");
const subscriptionModel = require("../models/subscriptionModel");
const paymentModel = require("../models/paymentModel");
const planModel = require("../models/planModel");
const { logInfo } = require("../utils/logger");

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Idempotent grant of a fixed-duration access period after a verified Order.
 * If the user already has a live period, EXTEND access_ends_at (stacking);
 * otherwise create a new active subscription. Records the payment.
 * Idempotency key: razorpay_payment_id (UNIQUE on payments).
 */
async function grantAccessPeriod({
  userId,
  planId,
  pricePointId,
  durationDays,
  razorpayOrderId,
  razorpayPaymentId,
  amountPaise,
  currency = "INR",
  campaignId = null,
  discountAmountPaise = 0,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency: if this payment was already recorded, do nothing.
    const existing = await paymentModel.getPaymentByRazorpayPaymentId(razorpayPaymentId, client);
    if (existing) {
      await client.query("COMMIT");
      const live = await subscriptionModel.getLiveSubscription(userId, client);
      return { subscription: live, payment: existing, idempotent: true };
    }

    const now = new Date();
    const live = await subscriptionModel.getLiveSubscription(userId, client);

    let subscription;
    if (live) {
      // Extend: stack duration on top of the later of (now, current end).
      const base = live.accessEndsAt && new Date(live.accessEndsAt) > now ? new Date(live.accessEndsAt) : now;
      subscription = await subscriptionModel.updateSubscription(
        live.id,
        {
          planId, // a paid checkout sets the purchased plan
          pricePointId,
          status: "active",
          accessEndsAt: addDays(base, durationDays),
        },
        client
      );
    } else {
      subscription = await subscriptionModel.createSubscription(
        {
          userId,
          planId,
          pricePointId,
          status: "active",
          source: "checkout",
          accessStartsAt: now,
          accessEndsAt: addDays(now, durationDays),
          campaignId,
        },
        client
      );
    }

    const payment = await paymentModel.createCapturedPayment(
      {
        userId,
        subscriptionId: subscription.id,
        planId,
        pricePointId,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise,
        currency,
        campaignId,
        discountAmountPaise,
      },
      client
    );

    await subscriptionModel.updateSubscription(subscription.id, { lastPaymentId: payment?.id ?? null }, client);

    await client.query("COMMIT");
    logInfo("SUBSCRIPTION_ACCESS_GRANTED", {
      userId, planId, subscriptionId: subscription.id, durationDays,
    });
    return { subscription, payment, idempotent: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** No-card trial: create a trialing access period. Caller handles campaign claim. */
async function grantTrial({ userId, planId, trialDays, campaignId = null }, client = pool) {
  const now = new Date();
  return subscriptionModel.createSubscription(
    {
      userId,
      planId,
      status: "trialing",
      source: "trial",
      accessStartsAt: now,
      accessEndsAt: addDays(now, trialDays),
      campaignId,
    },
    client
  );
}

/** Admin: grant or extend a fixed number of days. */
async function adminGrant({ userId, planId, days, source = "admin_grant" }) {
  const now = new Date();
  const live = await subscriptionModel.getLiveSubscription(userId);
  if (live) {
    const base = live.accessEndsAt && new Date(live.accessEndsAt) > now ? new Date(live.accessEndsAt) : now;
    return subscriptionModel.updateSubscription(live.id, {
      planId: planId || live.planId,
      status: "active",
      accessEndsAt: addDays(base, days),
    });
  }
  return subscriptionModel.createSubscription({
    userId,
    planId,
    status: "active",
    source,
    accessStartsAt: now,
    accessEndsAt: addDays(now, days),
  });
}

/**
 * Switch plan with carry-forward: preserve remaining access_ends_at, just change
 * the plan. No proration in Phase 1. Entitlements/onboarding re-resolve from the
 * new plan automatically.
 */
async function switchPlan({ userId, newPlanId }) {
  const live = await subscriptionModel.getLiveSubscription(userId);
  if (!live) {
    const err = new Error("No active subscription to switch");
    err.code = "NO_ACTIVE_SUBSCRIPTION";
    throw err;
  }
  const updated = await subscriptionModel.updateSubscription(live.id, { planId: newPlanId });
  logInfo("SUBSCRIPTION_PLAN_SWITCHED", {
    userId, fromPlanId: live.planId, toPlanId: newPlanId, accessEndsAt: live.accessEndsAt,
  });
  return updated;
}

/** Cancel: stop renewal prompts; access remains until period end unless immediate. */
async function cancel({ userId, immediate = false }) {
  const live = await subscriptionModel.getLiveSubscription(userId);
  if (!live) return null;
  if (immediate) {
    return subscriptionModel.updateSubscription(live.id, { status: "cancelled", accessEndsAt: new Date() });
  }
  return subscriptionModel.updateSubscription(live.id, { cancelAtPeriodEnd: true });
}

/** Expire elapsed access periods (scheduled job). */
async function expireElapsed() {
  const count = await subscriptionModel.expireElapsed();
  if (count > 0) logInfo("SUBSCRIPTIONS_EXPIRED", { count });
  return count;
}

/**
 * When trial_mode is "time", grant a one-time auto trial to brand-new users so they
 * receive N days of plan access without entering a campaign code. No-ops in usage mode
 * or when trials/paywall are off, or when the user already has subscription history.
 */
async function ensureAutoTimeTrial(userId) {
  const settingsService = require("./settingsService");
  const trialMode = await settingsService.getTrialMode();
  if (trialMode !== "time") return null;
  if (!(await settingsService.isPaywallEnabled())) return null;
  if (!(await settingsService.get("trials_enabled"))) return null;

  const live = await subscriptionModel.getLiveSubscription(userId);
  if (live) return live;

  if (await subscriptionModel.hasSubscriptionHistory(userId)) return null;

  const planSlug = String((await settingsService.get("default_trial_plan_slug")) || "byok");
  const plan = await planModel.getPlanBySlug(planSlug);
  if (!plan) return null;

  const trialDays = Number((await settingsService.get("default_trial_days")) || 7);
  const subscription = await grantTrial(
    { userId, planId: plan.id, trialDays, campaignId: null },
    pool
  );
  logInfo("AUTO_TIME_TRIAL_GRANTED", { userId, planId: plan.id, trialDays, planSlug });
  return subscription;
}

module.exports = {
  addDays,
  grantAccessPeriod,
  grantTrial,
  adminGrant,
  switchPlan,
  cancel,
  expireElapsed,
  ensureAutoTimeTrial,
};
