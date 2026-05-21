const { safeSseWrite, teardownResponse } = require("../src/realtime/sseSafeWrite");
const { getConnectionCount } = require("../src/realtime/sseConnectionRegistry");
const { metrics } = require("../src/observability/orchestrationMetrics");

function mockRes(overrides = {}) {
  return {
    writableEnded: false,
    destroyed: false,
    write: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  };
}

describe("safeSseWrite", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("returns ok on successful write", () => {
    const res = mockRes();
    const result = safeSseWrite(res, "user-1", ": ping\n\n");
    expect(result.ok).toBe(true);
    expect(res.write).toHaveBeenCalled();
  });

  it("handles ECONNRESET without throwing and tears down socket", () => {
    const res = mockRes({
      write: jest.fn(() => {
        const err = new Error("reset");
        err.code = "ECONNRESET";
        throw err;
      }),
    });

    const result = safeSseWrite(res, "user-1", "data");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ECONNRESET");
    expect(res.end).toHaveBeenCalled();
    expect(res.destroy).toHaveBeenCalled();
    const snap = metrics.getSnapshot();
    expect(snap.counters["orchestration.sse.write_reset|code=ECONNRESET"]).toBe(1);
  });
});

describe("teardownResponse", () => {
  it("is safe when res already ended", () => {
    const res = mockRes({ writableEnded: true });
    expect(() => teardownResponse(res, null, "test")).not.toThrow();
  });
});
