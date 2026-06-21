const entitlementService = require("./entitlementService");
const planModel = require("../models/planModel");

/**
 * Plan-driven onboarding. Steps come from the active plan's onboarding_flows row;
 * completion is DERIVED from setup facts (no persistent "complete" flag). This is
 * what lets a plan switch (e.g. managed -> byok) automatically re-open the BYOK
 * step the user never did.
 */

const DEFAULT_STEPS = ["byok", "resume", "email"];

// Which steps block "ready", and how each maps to the legacy client step name.
const STEP_META = {
  byok: { blocking: true, clientStep: "ai", fact: "hasVerifiedAiCredential" },
  resume: { blocking: true, clientStep: "resume", fact: "hasValidResume" },
  email: { blocking: false, clientStep: "email", fact: "hasEmailSetup" },
  profile: { blocking: false, clientStep: "profile", fact: null },
  preferences: { blocking: false, clientStep: "preferences", fact: null },
};

function isComplete(stepKey, facts) {
  const meta = STEP_META[stepKey];
  if (!meta || !meta.fact) return true; // unknown/no-fact steps don't block
  return Boolean(facts[meta.fact]);
}

/**
 * @param {string} userId
 * @param {{hasVerifiedAiCredential:boolean, hasValidResume:boolean, hasEmailSetup:boolean}} facts
 */
async function resolveOnboarding(userId, facts) {
  let stepKeys = DEFAULT_STEPS;
  let planSlug = null;
  try {
    const entitlement = await entitlementService.getEntitlement(userId);
    planSlug = entitlement.planSlug;
    if (entitlement.planId) {
      const flow = await planModel.getOnboardingFlow(entitlement.planId);
      if (Array.isArray(flow) && flow.length) stepKeys = flow;
    }
  } catch {
    stepKeys = DEFAULT_STEPS;
  }

  const steps = stepKeys.map((key) => {
    const meta = STEP_META[key] || { blocking: false, clientStep: key };
    return { key, blocking: Boolean(meta.blocking), complete: isComplete(key, facts) };
  });

  const firstIncompleteBlocking = steps.find((s) => s.blocking && !s.complete);
  const onboardingRequired = Boolean(firstIncompleteBlocking);
  const currentOnboardingStep = firstIncompleteBlocking
    ? STEP_META[firstIncompleteBlocking.key].clientStep
    : "ready";

  return { planSlug, steps, onboardingRequired, currentOnboardingStep };
}

module.exports = { DEFAULT_STEPS, STEP_META, resolveOnboarding };
