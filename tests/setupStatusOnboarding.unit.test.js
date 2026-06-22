jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("../src/models/userModel", () => ({
  getUserDefaults: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/models/resumeModel", () => ({
  getResumeById: jest.fn(),
}));
jest.mock("../src/models/aiCredentialModel", () => ({
  listByUser: jest.fn(),
  getVerifiedCredentialForUser: jest.fn(),
}));
jest.mock("../src/config", () => ({
  product: { pricingEnabled: true },
  ai: { openaiApiKey: null },
}));
jest.mock("../src/services/entitlementService", () => ({
  getEntitlement: jest.fn().mockImplementation(async () => {
    const config = require("../src/config");
    const paywallEnabled = config.product.pricingEnabled !== false;
    return {
      entitled: !paywallEnabled,
      paywallEnabled,
      planSlug: null,
      status: paywallEnabled ? "none" : "active",
      entitlements: { can_use_managed_ai: true, can_use_byok: false },
    };
  }),
}));
jest.mock("../src/services/settingsService", () => ({
  getPaywallTrigger: jest.fn().mockResolvedValue("after_plan_selection"),
  isPaywallEnabled: jest.fn().mockImplementation(async () => {
    const config = require("../src/config");
    return config.product.pricingEnabled !== false;
  }),
  getTrialMode: jest.fn().mockResolvedValue("usage"),
}));

const { pool } = require("../src/db");
const aiCredentialModel = require("../src/models/aiCredentialModel");
const { buildSetupStatus, userHasVerifiedAiCredential } = require("../src/services/setupStatusService");

describe("buildSetupStatus onboarding fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiCredentialModel.listByUser.mockResolvedValue([]);
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue(null);
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM users")) {
        return { rows: [{ subscription_status: "inactive", subscription_tier: "free" }] };
      }
      if (sql.includes("FROM resumes")) return { rows: [] };
      if (sql.includes("user_email_credentials")) return { rows: [] };
      if (sql.includes("parsed_resumes")) return { rows: [] };
      return { rows: [] };
    });
  });

  it("treats inactive users as subscribed when pricing is disabled", async () => {
    const config = require("../src/config");
    config.product.pricingEnabled = false;
    const status = await buildSetupStatus("user-1");
    expect(status.pricingEnabled).toBe(false);
    expect(status.hasActiveSubscription).toBe(true);
    config.product.pricingEnabled = true;
  });

  it("marks onboarding required at resume when managed AI is available", async () => {
    const status = await buildSetupStatus("user-1");
    expect(status.hasVerifiedAiCredential).toBe(false);
    expect(status.canUseManagedAi).toBe(true);
    expect(status.hasAiSetup).toBe(true);
    expect(status.onboardingRequired).toBe(true);
    expect(status.currentOnboardingStep).toBe("resume");
  });

  it("marks resume step when resume is missing", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({
      lastValidatedAt: new Date().toISOString(),
    });
    const status = await buildSetupStatus("user-1");
    expect(status.hasVerifiedAiCredential).toBe(true);
    expect(status.onboardingRequired).toBe(true);
    expect(status.currentOnboardingStep).toBe("resume");
  });

  it("advances to email step when resume is set, even without SMTP", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({
      lastValidatedAt: new Date().toISOString(),
    });
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM resumes")) {
        return {
          rows: [{ id: "r1", fileHash: "h", filename: "cv.pdf", uploadedAt: new Date().toISOString() }],
        };
      }
      if (sql.includes("parsed_resumes")) return { rows: [{ ok: 1 }] };
      if (sql.includes("user_email_credentials")) return { rows: [] };
      if (sql.includes("email_accounts")) return { rows: [] };
      if (sql.includes("FROM users")) {
        return { rows: [{ subscription_status: "inactive", subscription_tier: "free" }] };
      }
      return { rows: [] };
    });
    const status = await buildSetupStatus("user-1");
    expect(status.hasResume).toBe(true);
    expect(status.hasValidResume).toBe(true);
    expect(status.hasEmailSetup).toBe(false);
    expect(status.onboardingRequired).toBe(false);
    expect(status.currentOnboardingStep).toBe("email");
  });

  it("advances to email when resume is uploaded but parsing is still in progress", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({
      lastValidatedAt: new Date().toISOString(),
    });
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("parsed_resumes")) return { rows: [] };
      if (sql.includes("FROM resumes")) {
        return {
          rows: [{ id: "r1", fileHash: "h", filename: "cv.pdf", uploadedAt: new Date().toISOString() }],
        };
      }
      if (sql.includes("user_email_credentials")) return { rows: [] };
      if (sql.includes("email_accounts")) return { rows: [] };
      if (sql.includes("FROM users")) {
        return { rows: [{ subscription_status: "inactive", subscription_tier: "free" }] };
      }
      return { rows: [] };
    });
    const status = await buildSetupStatus("user-1");
    expect(status.hasResume).toBe(true);
    expect(status.hasValidResume).toBe(false);
    expect(status.onboardingRequired).toBe(false);
    expect(status.currentOnboardingStep).toBe("email");
  });
});

describe("userHasVerifiedAiCredential", () => {
  it("returns true when verified row exists", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({ id: "c1" });
    await expect(userHasVerifiedAiCredential("u1")).resolves.toBe(true);
  });
});
