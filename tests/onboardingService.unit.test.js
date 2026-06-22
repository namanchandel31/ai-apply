jest.mock("../src/services/entitlementService", () => ({
  getEntitlement: jest.fn(),
}));
jest.mock("../src/models/planModel", () => ({
  getOnboardingFlow: jest.fn(),
}));

const entitlementService = require("../src/services/entitlementService");
const planModel = require("../src/models/planModel");
const { resolveOnboarding } = require("../src/services/onboardingService");

describe("resolveOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    entitlementService.getEntitlement.mockResolvedValue({
      planId: "plan-1",
      planSlug: "managed",
      entitlements: { can_use_managed_ai: true, can_use_byok: false },
    });
    planModel.getOnboardingFlow.mockResolvedValue(["resume", "email"]);
  });

  it("points current step to email after resume when email is not configured", async () => {
    const result = await resolveOnboarding("user-1", {
      hasVerifiedAiCredential: false,
      canUseManagedAi: true,
      hasResume: true,
      hasValidResume: true,
      hasEmailSetup: false,
    });
    expect(result.onboardingRequired).toBe(false);
    expect(result.currentOnboardingStep).toBe("email");
  });

  it("advances to email when resume is uploaded but not yet parsed", async () => {
    const result = await resolveOnboarding("user-1", {
      hasVerifiedAiCredential: false,
      canUseManagedAi: true,
      hasResume: true,
      hasValidResume: false,
      hasEmailSetup: false,
    });
    expect(result.onboardingRequired).toBe(false);
    expect(result.currentOnboardingStep).toBe("email");
  });

  it("is ready when all guided steps are complete", async () => {
    const result = await resolveOnboarding("user-1", {
      hasVerifiedAiCredential: false,
      canUseManagedAi: true,
      hasResume: true,
      hasValidResume: true,
      hasEmailSetup: true,
    });
    expect(result.currentOnboardingStep).toBe("ready");
  });

  it("ignores byok in plan onboarding flow (BYOK is Setup-only)", async () => {
    planModel.getOnboardingFlow.mockResolvedValue(["byok", "resume", "email"]);
    const result = await resolveOnboarding("user-1", {
      hasVerifiedAiCredential: false,
      canUseManagedAi: false,
      hasResume: false,
      hasValidResume: false,
      hasEmailSetup: false,
    });
    expect(result.currentOnboardingStep).toBe("resume");
    expect(result.steps.every((s) => s.key !== "byok")).toBe(true);
  });
});
