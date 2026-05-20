const { orchestrationDedupe, resetForTests } = require("../src/utils/logDedupe");
const { logWarn } = require("../src/utils/logger");

jest.mock("../src/utils/logger", () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

describe("logDedupe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetForTests();
  });

  it("collapses 127 warns into one summary on flush", () => {
    const key = "app-1";
    for (let i = 0; i < 127; i++) {
      orchestrationDedupe.record("warn", "EVENT_REJECTED_STALE", key, {
        applicationId: key,
        component: "reconciliation",
      });
    }
    orchestrationDedupe.flush(Date.now() + 61_000);
    expect(logWarn).toHaveBeenCalled();
    const events = logWarn.mock.calls.map((c) => c[0]);
    expect(events.filter((e) => e === "EVENT_REJECTED_STALE").length).toBeLessThanOrEqual(2);
  });

  it("getDedupeStats reports bounded bucket count", () => {
    for (let i = 0; i < 10; i++) {
      orchestrationDedupe.record("warn", "TEST_EVENT", `k-${i}`, {});
    }
    const stats = orchestrationDedupe.getStats();
    expect(stats.activeBucketCount).toBeLessThanOrEqual(stats.maxBuckets);
    expect(stats.dedupeMemoryUsageEstimate).toBeGreaterThan(0);
  });

  it("prune expires inactive buckets", () => {
    orchestrationDedupe.record("warn", "EXPIRE_ME", "x", {});
    orchestrationDedupe.prune(Date.now() + 200_000);
    const stats = orchestrationDedupe.getStats();
    expect(stats.activeBucketCount).toBe(0);
  });
});
