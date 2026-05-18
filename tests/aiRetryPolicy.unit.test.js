const { RetryableError, NonRetryableError } = require("../src/utils/errors");
const {
  classifyExecutionFailure,
  shouldSkipCredentialForHealth,
  canAutoRecoverHealth,
  isTerminalHealth,
} = require("../src/services/aiRetryPolicy");

describe("aiRetryPolicy", () => {
  it("classifies 401 as invalid terminal", () => {
    const err = new NonRetryableError("auth");
    err.status = 401;
    const r = classifyExecutionFailure(err);
    expect(r.retryable).toBe(false);
    expect(r.healthTransition).toBe("invalid");
    expect(r.skipCredential).toBe(true);
  });

  it("classifies 429 as rate_limited recoverable", () => {
    const err = new RetryableError("slow down");
    err.status = 429;
    const r = classifyExecutionFailure(err);
    expect(r.retryable).toBe(true);
    expect(r.healthTransition).toBe("rate_limited");
  });

  it("should skip invalid health", () => {
    expect(shouldSkipCredentialForHealth("invalid")).toBe(true);
    expect(shouldSkipCredentialForHealth("healthy")).toBe(false);
  });

  it("terminal vs recoverable", () => {
    expect(isTerminalHealth("invalid")).toBe(true);
    expect(canAutoRecoverHealth("rate_limited")).toBe(true);
    expect(canAutoRecoverHealth("invalid")).toBe(false);
  });
});
