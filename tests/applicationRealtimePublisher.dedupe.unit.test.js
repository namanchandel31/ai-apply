const {
  shouldSkipDuplicatePublish,
  resetRealtimePublishStateForTests,
} = require("../src/services/applicationRealtimePublisher");
const { metrics } = require("../src/observability/orchestrationMetrics");

describe("shouldSkipDuplicatePublish", () => {
  beforeEach(() => {
    resetRealtimePublishStateForTests();
    metrics.reset();
  });

  it("allows first publish and skips duplicate within dedupe window", () => {
    const payload = {
      applicationId: "app-1",
      status: "draft",
      updatedAt: "2026-05-20T12:00:00.000Z",
    };

    expect(shouldSkipDuplicatePublish(payload)).toBe(false);
    expect(shouldSkipDuplicatePublish(payload)).toBe(true);

    const snap = metrics.getSnapshot();
    expect(snap.counters["orchestration.realtime.dedupe_skip"]).toBe(1);
  });

  it("allows publish when updatedAt changes", () => {
    const base = {
      applicationId: "app-1",
      status: "draft",
    };
    expect(
      shouldSkipDuplicatePublish({ ...base, updatedAt: "2026-05-20T12:00:00.000Z" })
    ).toBe(false);
    expect(
      shouldSkipDuplicatePublish({ ...base, updatedAt: "2026-05-20T12:01:00.000Z" })
    ).toBe(false);
  });
});
