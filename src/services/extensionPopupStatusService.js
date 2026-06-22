const { buildSetupStatus } = require("./setupStatusService");
const { getUserById } = require("../models/userModel");

/**
 * Combined popup payload for extension — setup gating fields + apply mode + plan.
 */
function formatPlanLabel(setup) {
  const names = {
    byok: "Bring your own AI",
    onetap_llm: "OneTap LLM",
  };
  const name = names[setup.planSlug] || setup.planSlug || null;

  if (setup.subscriptionState === "trialing") {
    return name ? `Free trial · ${name}` : "Free trial";
  }
  if (setup.hasActiveSubscription) {
    return name || "Subscribed";
  }
  if (setup.canUseManagedAi) {
    return "OneTap AI";
  }
  if (setup.pricingEnabled) {
    return "Free trial";
  }
  return name || "No active plan";
}

async function buildExtensionPopupStatus(userId) {
  const [setup, user] = await Promise.all([
    buildSetupStatus(userId),
    getUserById(userId),
  ]);

  return {
    setup: {
      hasValidResume: setup.hasValidResume,
      hasEmailSetup: setup.hasEmailSetup,
      hasAiSetup: setup.hasAiSetup,
      canUseManagedAi: setup.canUseManagedAi,
      hasVerifiedAiCredential: setup.hasVerifiedAiCredential,
    },
    applyMode: user?.apply_mode ?? "review_apply",
    plan: {
      slug: setup.planSlug ?? null,
      label: formatPlanLabel(setup),
    },
  };
}

module.exports = {
  buildExtensionPopupStatus,
};
