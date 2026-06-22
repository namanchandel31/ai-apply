jest.mock("../src/services/usageService", () => ({
  checkQuota: jest.fn(),
  isUnlimited: (n) => n === null || n === undefined || Number(n) < 0,
}));

jest.mock("../src/services/trialLimitService", () => ({
  checkApplicationQuota: jest.fn(),
}));

const usageService = require("../src/services/usageService");
const trialLimitService = require("../src/services/trialLimitService");
const quotaService = require("../src/services/quotaService");

describe("quotaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes application sent checks through trialLimitService", async () => {
    trialLimitService.checkApplicationQuota.mockResolvedValue({
      allowed: true,
      limit: 20,
      used: 5,
      remaining: 15,
    });
    const result = await quotaService.check("u1", quotaService.QUOTA_FEATURE_KEYS.APPLICATION_SENT);
    expect(trialLimitService.checkApplicationQuota).toHaveBeenCalledWith("u1");
    expect(result.remaining).toBe(15);
  });

  it("routes other features through usageService.checkQuota", async () => {
    usageService.checkQuota.mockResolvedValue({ allowed: false, limit: 2, used: 2, remaining: 0 });
    const result = await quotaService.check("u1", quotaService.QUOTA_FEATURE_KEYS.RESUME_PARSED);
    expect(usageService.checkQuota).toHaveBeenCalled();
    expect(result.allowed).toBe(false);
  });

  it("skips check without userId", async () => {
    const result = await quotaService.check(null, quotaService.QUOTA_FEATURE_KEYS.JD_PARSED);
    expect(result.skipped).toBe(true);
  });
});
