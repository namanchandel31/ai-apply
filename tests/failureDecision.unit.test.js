const { shouldPersistTerminalFailure } = require("../src/services/failureDecision");
const { RetryableError, NonRetryableError } = require("../src/utils/errors");

describe("shouldPersistTerminalFailure", () => {
  const job = { opts: { attempts: 3 }, attemptsMade: 0 };

  it("does not persist on first retryable failure", () => {
    expect(shouldPersistTerminalFailure(job, new RetryableError("timeout"))).toBe(false);
  });

  it("persists on NonRetryableError", () => {
    expect(shouldPersistTerminalFailure(job, new NonRetryableError("invalid"))).toBe(true);
  });

  it("persists when attempts exhausted", () => {
    const exhausted = { opts: { attempts: 3 }, attemptsMade: 3 };
    expect(shouldPersistTerminalFailure(exhausted, new RetryableError("timeout"))).toBe(true);
  });
});
