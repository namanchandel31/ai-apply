const { deriveOnboardingState } = require("../src/services/onboardingDerivation");

describe("deriveOnboardingState", () => {
  it("requires onboarding when AI not verified", () => {
    const r = deriveOnboardingState({ hasVerifiedAiCredential: false, hasValidResume: true });
    expect(r.onboardingRequired).toBe(true);
    expect(r.currentOnboardingStep).toBe("ai");
  });

  it("requires onboarding when resume not valid", () => {
    const r = deriveOnboardingState({ hasVerifiedAiCredential: true, hasValidResume: false });
    expect(r.onboardingRequired).toBe(true);
    expect(r.currentOnboardingStep).toBe("resume");
  });

  it("is ready when both verified AI and valid resume", () => {
    const r = deriveOnboardingState({ hasVerifiedAiCredential: true, hasValidResume: true });
    expect(r.onboardingRequired).toBe(false);
    expect(r.currentOnboardingStep).toBe("ready");
  });
});
