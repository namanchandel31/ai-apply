const {
  classifyHealthCheckError,
  createOperationTimeout,
} = require("../src/utils/operationTimeout");

describe("operationTimeout", () => {
  it("classifies client abort as HEALTH_CHECK_TIMEOUT", () => {
    const err = new Error("This operation was aborted");
    err.name = "AbortError";
    const r = classifyHealthCheckError(err, {
      timeoutMs: 20000,
      elapsedMs: 20001,
      provider: "openrouter",
      wasTimedOut: true,
    });
    expect(r.code).toBe("HEALTH_CHECK_TIMEOUT");
    expect(r.errorType).toBe("abort_timeout");
  });

  it("classifies ETIMEDOUT as PROVIDER_TIMEOUT", () => {
    const err = new Error("timeout");
    err.code = "ETIMEDOUT";
    const r = classifyHealthCheckError(err, {
      timeoutMs: 20000,
      elapsedMs: 19000,
      provider: "openrouter",
      wasTimedOut: false,
    });
    expect(r.code).toBe("PROVIDER_TIMEOUT");
    expect(r.errorType).toBe("provider_timeout");
  });

  it("classifies 401 as AUTH_FAILURE", () => {
    const err = new Error("Unauthorized");
    err.status = 401;
    const r = classifyHealthCheckError(err, {
      timeoutMs: 20000,
      elapsedMs: 500,
      provider: "openrouter",
      wasTimedOut: false,
    });
    expect(r.code).toBe("AUTH_FAILURE");
    expect(r.errorType).toBe("auth_failure");
  });

  it("clears timer without leak", () => {
    const op = createOperationTimeout(50_000, { operationType: "health_check", provider: "test" });
    op.clear();
    expect(op.wasTimedOut()).toBe(false);
  });
});

describe("aiTimeoutConfig defaults", () => {
  const original = process.env.HEALTH_CHECK_TIMEOUT_MS;
  afterEach(() => {
    if (original === undefined) delete process.env.HEALTH_CHECK_TIMEOUT_MS;
    else process.env.HEALTH_CHECK_TIMEOUT_MS = original;
    jest.resetModules();
  });

  it("defaults health check to 20s when env unset", () => {
    delete process.env.HEALTH_CHECK_TIMEOUT_MS;
    jest.resetModules();
    const cfg = require("../src/config/aiTimeoutConfig");
    expect(cfg.HEALTH_CHECK_TIMEOUT_MS).toBe(20_000);
  });
});
