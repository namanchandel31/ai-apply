const { deriveOnboardingState } = require("../src/services/onboardingDerivation");

describe("deriveOnboardingState", () => {
  it("requires onboarding when AI not verified", () => {
    const r = deriveOnboardingState({
      hasVerifiedAiCredential: false,
      hasValidResume: true,
      hasEmailSetup: true,
    });
    expect(r.onboardingRequired).toBe(true);
    expect(r.currentOnboardingStep).toBe("ai");
  });

  it("requires onboarding when resume not valid", () => {
    const r = deriveOnboardingState({
      hasVerifiedAiCredential: true,
      hasValidResume: false,
      hasEmailSetup: true,
    });
    expect(r.onboardingRequired).toBe(true);
    expect(r.currentOnboardingStep).toBe("resume");
  });

  it("requires onboarding when email not connected", () => {
    const r = deriveOnboardingState({
      hasVerifiedAiCredential: true,
      hasValidResume: true,
      hasEmailSetup: false,
    });
    expect(r.onboardingRequired).toBe(true);
    expect(r.currentOnboardingStep).toBe("email");
  });

  it("is ready when AI, resume, and email are set", () => {
    const r = deriveOnboardingState({
      hasVerifiedAiCredential: true,
      hasValidResume: true,
      hasEmailSetup: true,
    });
    expect(r.onboardingRequired).toBe(false);
    expect(r.currentOnboardingStep).toBe("ready");
  });
});
