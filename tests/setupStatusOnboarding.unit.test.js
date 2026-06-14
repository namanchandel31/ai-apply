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

const { pool } = require("../src/db");
const aiCredentialModel = require("../src/models/aiCredentialModel");
const { buildSetupStatus, userHasVerifiedAiCredential } = require("../src/services/setupStatusService");

describe("buildSetupStatus onboarding fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiCredentialModel.listByUser.mockResolvedValue([]);
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue(null);
    pool.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM resumes")) return { rows: [] };
      if (sql.includes("user_email_credentials")) return { rows: [] };
      if (sql.includes("parsed_resumes")) return { rows: [] };
      return { rows: [] };
    });
  });

  it("marks onboarding required when AI not verified", async () => {
    const status = await buildSetupStatus("user-1");
    expect(status.hasVerifiedAiCredential).toBe(false);
    expect(status.onboardingRequired).toBe(true);
    expect(status.currentOnboardingStep).toBe("ai");
  });

  it("marks resume step when AI verified but resume invalid", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({
      lastValidatedAt: new Date().toISOString(),
    });
    const status = await buildSetupStatus("user-1");
    expect(status.hasVerifiedAiCredential).toBe(true);
    expect(status.onboardingRequired).toBe(true);
    expect(status.currentOnboardingStep).toBe("resume");
  });

  it("marks email step when AI and resume ready but no SMTP", async () => {
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
      return { rows: [] };
    });
    const status = await buildSetupStatus("user-1");
    expect(status.hasValidResume).toBe(true);
    expect(status.onboardingRequired).toBe(true);
    expect(status.currentOnboardingStep).toBe("email");
  });
});

describe("userHasVerifiedAiCredential", () => {
  it("returns true when verified row exists", async () => {
    aiCredentialModel.getVerifiedCredentialForUser.mockResolvedValue({ id: "c1" });
    await expect(userHasVerifiedAiCredential("u1")).resolves.toBe(true);
  });
});
