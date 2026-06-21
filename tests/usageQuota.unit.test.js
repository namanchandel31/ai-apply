jest.mock("../src/models/usageCounterModel");
jest.mock("../src/services/entitlementService");
jest.mock("../src/services/settingsService");

const usageCounterModel = require("../src/models/usageCounterModel");
const entitlementService = require("../src/services/entitlementService");
const settingsService = require("../src/services/settingsService");
const usageService = require("../src/services/usageService");

describe("usageService.enforceQuota (atomic)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getTrialMode.mockResolvedValue("usage");
  });

  it("uses a conditional increment and allows when within the limit", async () => {
    entitlementService.getEntitlement.mockResolvedValue({
      paywallEnabled: true,
      entitlements: { quota_applications_sent: 10 },
    });
    usageCounterModel.consumeIfWithinLimit.mockResolvedValue(3);

    const result = await usageService.enforceQuota("u1", "quota_applications_sent", 1, {
      period: "lifetime",
    });

    expect(usageCounterModel.consumeIfWithinLimit).toHaveBeenCalledWith(
      "u1",
      "quota_applications_sent",
      "lifetime",
      1,
      10
    );
    expect(result).toEqual({ allowed: true, unlimited: false, used: 3, limit: 10 });
  });

  it("throws QUOTA_EXCEEDED with remaining when the atomic increment is rejected (null)", async () => {
    entitlementService.getEntitlement.mockResolvedValue({
      paywallEnabled: true,
      entitlements: { quota_applications_sent: 10 },
    });
    usageCounterModel.consumeIfWithinLimit.mockResolvedValue(null);
    usageCounterModel.getUsage.mockResolvedValue(10);

    await expect(
      usageService.enforceQuota("u1", "quota_applications_sent", 1, { period: "lifetime" })
    ).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
      limit: 10,
      used: 10,
      remaining: 0,
      upgradeEligible: true,
    });
  });

  it("does not gate when the limit is unlimited (-1)", async () => {
    entitlementService.getEntitlement.mockResolvedValue({
      paywallEnabled: true,
      entitlements: { quota_applications_sent: -1 },
    });
    usageCounterModel.consume.mockResolvedValue(99);

    const result = await usageService.enforceQuota("u1", "quota_applications_sent", 1, {
      period: "lifetime",
    });
    expect(result.unlimited).toBe(true);
    expect(usageCounterModel.consumeIfWithinLimit).not.toHaveBeenCalled();
  });

  it("release floors the counter via the model's atomic decrement", async () => {
    usageCounterModel.release.mockResolvedValue(2);
    const remaining = await usageService.release("u1", "quota_applications_sent", 1, {
      period: "lifetime",
    });
    expect(usageCounterModel.release).toHaveBeenCalledWith(
      "u1",
      "quota_applications_sent",
      "lifetime",
      1
    );
    expect(remaining).toBe(2);
  });

  it("does not gate quota features when trial_mode is time", async () => {
    settingsService.getTrialMode.mockResolvedValue("time");
    entitlementService.getEntitlement.mockResolvedValue({
      paywallEnabled: true,
      entitlements: { quota_applications_sent: 10 },
    });
    usageCounterModel.consume.mockResolvedValue(1);

    const result = await usageService.enforceQuota("u1", "quota_applications_sent", 1, {
      period: "lifetime",
    });
    expect(result.unlimited).toBe(true);
    expect(usageCounterModel.consumeIfWithinLimit).not.toHaveBeenCalled();
  });
});
