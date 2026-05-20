const {
  getPoolMetrics,
  SLOW_QUERY_MS,
  STATUS_QUERY_NAMES,
} = require("../src/db/queryInstrumentation");

describe("queryInstrumentation", () => {
  it("defines slow query threshold at 100ms", () => {
    expect(SLOW_QUERY_MS).toBe(100);
  });

  it("tracks status query names", () => {
    expect(STATUS_QUERY_NAMES.has("status_bundle")).toBe(true);
    expect(STATUS_QUERY_NAMES.has("status_fingerprint")).toBe(true);
  });

  it("getPoolMetrics reads pg pool counters", () => {
    const metrics = getPoolMetrics({
      totalCount: 3,
      idleCount: 2,
      waitingCount: 1,
    });
    expect(metrics).toEqual({
      poolTotal: 3,
      poolIdle: 2,
      poolWaiting: 1,
    });
  });
});
