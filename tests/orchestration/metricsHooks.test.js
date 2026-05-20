const backendMetrics = require("../../src/observability/orchestrationMetrics");

describe("orchestration metrics hooks", () => {
  beforeEach(() => {
    backendMetrics.metrics.reset();
  });

  it("backend counters increment without throwing", () => {
    expect(() => {
      backendMetrics.metrics.increment("orchestration.test.counter", { ok: true });
      backendMetrics.metrics.histogram("orchestration.test.hist", 12);
      backendMetrics.metrics.gauge("orchestration.test.gauge", 3);
    }).not.toThrow();
    const snap = backendMetrics.metrics.getSnapshot();
    expect(Object.keys(snap.counters).length).toBeGreaterThan(0);
  });

  it("default no-op style reset clears state", () => {
    backendMetrics.metrics.increment("x");
    backendMetrics.metrics.reset();
    expect(backendMetrics.metrics.getSnapshot().counters).toEqual({});
  });
});
