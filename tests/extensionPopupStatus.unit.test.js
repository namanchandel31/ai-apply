const { buildExtensionPopupStatus } = require("../src/services/extensionPopupStatusService");

jest.mock("../src/services/setupStatusService", () => ({
  buildSetupStatus: jest.fn(),
}));

jest.mock("../src/models/userModel", () => ({
  getUserById: jest.fn(),
}));

const { buildSetupStatus } = require("../src/services/setupStatusService");
const { getUserById } = require("../src/models/userModel");

describe("extensionPopupStatusService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("combines setup gating fields and apply mode", async () => {
    buildSetupStatus.mockResolvedValue({
      hasValidResume: true,
      hasEmailSetup: true,
      hasVerifiedAiCredential: false,
      hasResume: true,
      hasAiSetup: true,
      planSlug: "byok",
      hasActiveSubscription: true,
      subscriptionState: "active",
      canUseManagedAi: false,
      pricingEnabled: true,
    });
    getUserById.mockResolvedValue({ apply_mode: "auto_apply" });

    const result = await buildExtensionPopupStatus("user-1");

    expect(result).toEqual({
      setup: {
        hasValidResume: true,
        hasEmailSetup: true,
        hasVerifiedAiCredential: false,
      },
      applyMode: "auto_apply",
      plan: {
        slug: "byok",
        label: "Bring your own AI",
      },
    });
    expect(buildSetupStatus).toHaveBeenCalledWith("user-1");
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });

  it("defaults apply mode when user row is missing", async () => {
    buildSetupStatus.mockResolvedValue({
      hasValidResume: false,
      hasEmailSetup: false,
      hasVerifiedAiCredential: false,
      pricingEnabled: true,
    });
    getUserById.mockResolvedValue(null);

    const result = await buildExtensionPopupStatus("user-2");

    expect(result.applyMode).toBe("review_apply");
    expect(result.plan.label).toBe("Free trial");
  });
});
