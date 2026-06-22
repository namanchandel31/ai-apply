const entitlementService = require("./entitlementService");
const planModel = require("../models/planModel");

/**
 * Plan-driven onboarding. BYOK is configured in Setup after plan selection — not here.
 */

const DEFAULT_STEPS = ["resume", "email"];

const ONBOARDING_ONLY_STEPS = new Set(["resume", "email", "profile", "preferences"]);

// Which steps block "ready", and how each maps to the legacy client step name.
const STEP_META = {
  byok: { blocking: false, clientStep: "ai", fact: "hasVerifiedAiCredential" },
  resume: { blocking: true, clientStep: "resume", fact: "hasResume" },
  email: { blocking: false, clientStep: "email", fact: "hasEmailSetup" },
  profile: { blocking: false, clientStep: "profile", fact: null },
  preferences: { blocking: false, clientStep: "preferences", fact: null },
};

function isComplete(stepKey, facts) {
  const meta = STEP_META[stepKey];
  if (!meta || !meta.fact) {
    return true;
  }
  return Boolean(facts[meta.fact]);
}

/**
 * @param {string} userId
 * @param {{hasVerifiedAiCredential:boolean, hasResume:boolean, hasValidResume:boolean, hasEmailSetup:boolean}} facts
 */
async function resolveOnboarding(userId, facts) {
  let stepKeys = DEFAULT_STEPS;
  let planSlug = null;
  try {
    const entitlement = await entitlementService.getEntitlement(userId);
    planSlug = entitlement.planSlug;
    if (entitlement.planId) {
      const flow = await planModel.getOnboardingFlow(entitlement.planId);
      if (Array.isArray(flow) && flow.length) {
        stepKeys = flow.filter((key) => ONBOARDING_ONLY_STEPS.has(key));
      }
    }
  } catch {
    stepKeys = DEFAULT_STEPS;
  }

  const steps = stepKeys.map((key) => {
    const meta = STEP_META[key] || { blocking: false, clientStep: key };
    return { key, blocking: Boolean(meta.blocking), complete: isComplete(key, facts) };
  });

  const firstIncompleteBlocking = steps.find((s) => s.blocking && !s.complete);
  const firstIncompleteGuided = steps.find((s) => !s.complete);
  const onboardingRequired = Boolean(firstIncompleteBlocking);

  let currentOnboardingStep = "ready";
  if (firstIncompleteBlocking) {
    currentOnboardingStep = STEP_META[firstIncompleteBlocking.key]?.clientStep ?? firstIncompleteBlocking.key;
  } else if (firstIncompleteGuided) {
    currentOnboardingStep = STEP_META[firstIncompleteGuided.key]?.clientStep ?? firstIncompleteGuided.key;
  }

  return { planSlug, steps, onboardingRequired, currentOnboardingStep };
}

module.exports = { DEFAULT_STEPS, STEP_META, resolveOnboarding };
