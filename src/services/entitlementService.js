const settingsService = require("./settingsService");
const subscriptionModel = require("../models/subscriptionModel");
const subscriptionService = require("./subscriptionService");
const planModel = require("../models/planModel");

/**
 * Single authority for "what can this user access right now, and what are they
 * allowed to do?" Resolves the active access period + the plan's entitlement map
 * (catalog-joined, with catalog defaults). Replaces the binary hasActiveSubscription.
 */
async function getEntitlement(userId) {
  const paywallEnabled = await settingsService.isPaywallEnabled();

  // Time-trial mode: lazily grant a one-time access period for brand-new users.
  if (paywallEnabled && userId) {
    await subscriptionService.ensureAutoTimeTrial(userId);
  }

  const live = await subscriptionModel.getLiveSubscription(userId);

  // When the paywall is off, everyone is entitled. Use the live plan's map if
  // present, otherwise catalog defaults.
  if (!paywallEnabled) {
    const entitlements = live
      ? await planModel.resolveEntitlementMap(live.planId)
      : await planModel.resolveDefaultEntitlementMap();
    return {
      entitled: true,
      paywallEnabled: false,
      planId: live ? live.planId : null,
      planSlug: live ? (await planModel.getPlanById(live.planId))?.slug ?? null : null,
      status: live ? live.status : "none",
      accessEndsAt: live ? live.accessEndsAt : null,
      source: live ? live.source : null,
      entitlements,
    };
  }

  if (!live) {
    return {
      entitled: false,
      paywallEnabled: true,
      planId: null,
      planSlug: null,
      status: "none",
      accessEndsAt: null,
      source: null,
      entitlements: await planModel.resolveDefaultEntitlementMap(),
    };
  }

  const plan = await planModel.getPlanById(live.planId);
  const entitlements = await planModel.resolveEntitlementMap(live.planId);
  return {
    entitled: live.status === "active" || live.status === "trialing",
    paywallEnabled: true,
    planId: live.planId,
    planSlug: plan?.slug ?? null,
    status: live.status,
    accessEndsAt: live.accessEndsAt,
    source: live.source,
    entitlements,
  };
}

/** Convenience: the resolved entitlement map only. */
async function getEntitlements(userId) {
  const e = await getEntitlement(userId);
  return e.entitlements;
}

/** Boolean capability check. */
async function hasEntitlement(userId, featureKey) {
  const ent = await getEntitlements(userId);
  return ent[featureKey] === true;
}

module.exports = { getEntitlement, getEntitlements, hasEntitlement };
