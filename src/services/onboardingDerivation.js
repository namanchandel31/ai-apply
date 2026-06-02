/**
 * Derived onboarding state — no persistence; computed from setup facts only.
 */

const ONBOARDING_STEPS = Object.freeze(["ai", "resume", "ready"]);

/**
 * @param {{ hasVerifiedAiCredential: boolean, hasValidResume: boolean }} facts
 */
function deriveOnboardingState(facts) {
  const hasVerifiedAiCredential = !!facts.hasVerifiedAiCredential;
  const hasValidResume = !!facts.hasValidResume;

  const onboardingRequired = !hasVerifiedAiCredential || !hasValidResume;

  let currentOnboardingStep = "ready";
  if (!hasVerifiedAiCredential) {
    currentOnboardingStep = "ai";
  } else if (!hasValidResume) {
    currentOnboardingStep = "resume";
  }

  return {
    onboardingRequired,
    currentOnboardingStep,
    hasVerifiedAiCredential,
    hasValidResume,
  };
}

module.exports = {
  ONBOARDING_STEPS,
  deriveOnboardingState,
};
