jest.mock("../src/services/usageService", () => ({
  enforceQuota: jest.fn(),
  release: jest.fn(),
  checkQuota: jest.fn(),
}));

const usageService = require("../src/services/usageService");
const quotaService = require("../src/services/quotaService");

describe("quotaService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reserve atomically enforces against the lifetime period", async () => {
    usageService.enforceQuota.mockResolvedValue({ allowed: true, used: 1 });
    await quotaService.reserve("u1", quotaService.QUOTA_FEATURE_KEYS.APPLICATION_SENT);
    expect(usageService.enforceQuota).toHaveBeenCalledWith("u1", "quota_applications_sent", 1, {
      period: "lifetime",
    });
  });

  it("reserve propagates QUOTA_EXCEEDED so callers can paywall", async () => {
    const quotaErr = Object.assign(new Error("nope"), { code: "QUOTA_EXCEEDED" });
    usageService.enforceQuota.mockRejectedValue(quotaErr);
    await expect(
      quotaService.reserve("u1", quotaService.QUOTA_FEATURE_KEYS.RESUME_PARSED)
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("reserve no-ops without a userId (never gates legacy callers)", async () => {
    const result = await quotaService.reserve(null, quotaService.QUOTA_FEATURE_KEYS.JD_PARSED);
    expect(result).toEqual({ allowed: true, skipped: true });
    expect(usageService.enforceQuota).not.toHaveBeenCalled();
  });

  it("release decrements and never throws even if the store fails", async () => {
    usageService.release.mockRejectedValue(new Error("db down"));
    await expect(
      quotaService.release("u1", quotaService.QUOTA_FEATURE_KEYS.EMAIL_GENERATED)
    ).resolves.toBeUndefined();
    expect(usageService.release).toHaveBeenCalledWith("u1", "quota_emails_generated", 1, {
      period: "lifetime",
    });
  });

  it("check delegates to a non-consuming checkQuota", async () => {
    usageService.checkQuota.mockResolvedValue({ allowed: false, limit: 10, used: 10, remaining: 0 });
    const result = await quotaService.check("u1", quotaService.QUOTA_FEATURE_KEYS.APPLICATION_SENT);
    expect(result.allowed).toBe(false);
    expect(usageService.checkQuota).toHaveBeenCalledWith("u1", "quota_applications_sent", {
      period: "lifetime",
    });
  });
});
