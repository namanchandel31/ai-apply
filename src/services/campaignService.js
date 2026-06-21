const { pool } = require("../db");
const campaignModel = require("../models/campaignModel");
const settingsService = require("./settingsService");

function isWithinWindow(campaign, now = new Date()) {
  if (campaign.startsAt && new Date(campaign.startsAt) > now) return false;
  if (campaign.endsAt && new Date(campaign.endsAt) < now) return false;
  return true;
}

function appliesToPlan(campaign, planId) {
  const ids = campaign.applicablePlanIds || [];
  return ids.length === 0 || ids.includes(planId);
}

/** Effective discount in paise for a paid campaign against a base amount. */
function computeDiscountPaise(campaign, baseAmountPaise) {
  if (campaign.type !== "discount" || !campaign.discountType) return 0;
  if (campaign.discountType === "percent") {
    return Math.min(baseAmountPaise, Math.round((baseAmountPaise * campaign.discountAmount) / 100));
  }
  if (campaign.discountType === "fixed") {
    return Math.min(baseAmountPaise, campaign.discountAmount);
  }
  return 0;
}

/**
 * Eligibility check (no side effects). Returns { eligible, reason, campaign }.
 */
async function evaluate(userId, planId, campaign) {
  if (!campaign) return { eligible: false, reason: "not_found" };
  if (!campaign.enabled) return { eligible: false, reason: "disabled" };
  if (!isWithinWindow(campaign)) return { eligible: false, reason: "out_of_window" };
  if (!appliesToPlan(campaign, planId)) return { eligible: false, reason: "plan_not_applicable" };
  if (campaign.userLimit != null && campaign.claimedCount >= campaign.userLimit) {
    return { eligible: false, reason: "limit_reached" };
  }
  if (campaign.type === "trial") {
    const trialsEnabled = await settingsService.get("trials_enabled");
    if (!trialsEnabled) return { eligible: false, reason: "trials_disabled" };
  }
  const existing = await campaignModel.getRedemption(campaign.id, userId);
  if (existing) return { eligible: false, reason: "already_redeemed" };
  return { eligible: true, reason: "ok", campaign };
}

/**
 * Atomic slot claim. Single conditional UPDATE serializes concurrent writers so
 * exactly one wins the final slot; UNIQUE(campaign_id,user_id) blocks double-claim.
 * Must run inside the caller's transaction (pass client). Throws on failure.
 */
async function claimSlot(campaignId, userId, { subscriptionId = null, paymentId = null } = {}, client) {
  const db = client || pool;
  const { rows } = await db.query(
    `UPDATE campaigns SET claimed_count = claimed_count + 1
     WHERE id = $1 AND (user_limit IS NULL OR claimed_count < user_limit)
     RETURNING claimed_count`,
    [campaignId]
  );
  if (rows.length === 0) {
    const err = new Error("Campaign slot limit reached");
    err.code = "CAMPAIGN_FULL";
    throw err;
  }
  try {
    await db.query(
      `INSERT INTO campaign_redemptions (campaign_id, user_id, subscription_id, payment_id)
       VALUES ($1, $2, $3, $4)`,
      [campaignId, userId, subscriptionId, paymentId]
    );
  } catch (e) {
    if (e.code === "23505") {
      const err = new Error("Campaign already claimed by user");
      err.code = "CAMPAIGN_ALREADY_CLAIMED";
      throw err;
    }
    throw e;
  }
  return rows[0].claimed_count;
}

/**
 * No-card trial claim: validate eligibility, atomically claim the slot, and grant
 * a trialing access period — all in one transaction.
 */
async function claimTrial({ userId, campaignCode, planId }) {
  const subscriptionService = require("./subscriptionService");
  const campaign = await campaignModel.getByCode(campaignCode);
  const { eligible, reason } = await evaluate(userId, planId, campaign);
  if (!eligible) {
    const err = new Error(`Campaign not eligible: ${reason}`);
    err.code = "CAMPAIGN_INELIGIBLE";
    err.reason = reason;
    throw err;
  }
  if (campaign.type !== "trial") {
    const err = new Error("Campaign is not a trial");
    err.code = "CAMPAIGN_NOT_TRIAL";
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subscription = await subscriptionService.grantTrial(
      { userId, planId, trialDays: campaign.trialDays || 7, campaignId: campaign.id },
      client
    );
    await claimSlot(campaign.id, userId, { subscriptionId: subscription.id }, client);
    await client.query("COMMIT");
    return subscription;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Campaigns the user is currently eligible for (across applicable plans). */
async function listEligibleForUser(userId, planId = null) {
  const campaigns = await campaignModel.listCampaigns({ enabledOnly: true });
  const out = [];
  for (const c of campaigns) {
    const { eligible } = await evaluate(userId, planId, c);
    if (eligible) out.push(c);
  }
  return out;
}

module.exports = {
  evaluate,
  computeDiscountPaise,
  claimSlot,
  claimTrial,
  listEligibleForUser,
  isWithinWindow,
  appliesToPlan,
};
