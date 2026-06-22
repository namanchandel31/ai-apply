const settingsService = require("./settingsService");
const entitlementService = require("./entitlementService");

/**
 * Decides whether a specific gated action requires payment now, based on the
 * configured paywall trigger (one of three V1 values) and the user's entitlement.
 * Keeps the "where is the paywall" concern out of entitlement/billing code.
 *
 * Action keys map to triggers:
 *   - "access"        : general app access (gated by after_plan_selection/after_onboarding)
 *   - "first_apply"   : the apply action (gated by before_first_apply)
 */
const ACTION_TRIGGERS = Object.freeze({
  access: ["after_plan_selection"],
  first_apply: ["before_first_apply"],
  post_onboarding: ["after_onboarding"],
});

async function requiresPaymentNow(userId, actionKey = "access") {
  const paywallEnabled = await settingsService.isPaywallEnabled();
  if (!paywallEnabled) return { required: false, reason: "paywall_disabled" };

  const trigger = await settingsService.getPaywallTrigger();
  const ent = await entitlementService.getEntitlement(userId);
  if (ent.entitled) return { required: false, reason: "entitled" };

  const triggersForAction = ACTION_TRIGGERS[actionKey] || ACTION_TRIGGERS.access;
  const gated = triggersForAction.includes(trigger);
  return {
    required: gated,
    reason: gated ? "paywall_trigger" : "deferred",
    trigger,
  };
}

/**
 * The action that will next require payment given the trigger (used by the client
 * to place the gate). Returns null when paywall is off or user already entitled.
 */
async function nextPaywallAction(userId) {
  const paywallEnabled = await settingsService.isPaywallEnabled();
  if (!paywallEnabled) return null;
  const ent = await entitlementService.getEntitlement(userId);
  if (ent.entitled) return null;
  const trigger = await settingsService.getPaywallTrigger();
  if (trigger === "before_first_apply") return "first_apply";
  if (trigger === "after_onboarding") return "post_onboarding";
  return "access";
}

module.exports = { requiresPaymentNow, nextPaywallAction, ACTION_TRIGGERS };
