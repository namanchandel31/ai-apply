const { UnrecoverableError } = require("bullmq");
const {
  isNonRetryableApplicationError,
  willBullMqRetry,
  finalizeBullMqJobFailure,
} = require("../src/queues/bullmqJobFailure");
const { NonRetryableError } = require("../src/utils/errors");

describe("bullmqJobFailure", () => {
  it("detects NonRetryableError by name across realms", () => {
    const err = new NonRetryableError("invalid_parsed_content");
    expect(isNonRetryableApplicationError(err)).toBe(true);
  });

  it("willBullMqRetry is false for NonRetryableError", () => {
    const job = { opts: { attempts: 3 }, attemptsMade: 1 };
    const err = new NonRetryableError("invalid_parsed_content");
    expect(willBullMqRetry(job, err)).toBe(false);
  });

  it("finalizeBullMqJobFailure discards and throws UnrecoverableError", async () => {
    const discard = jest.fn().mockResolvedValue(undefined);
    const job = { id: "j1", queueName: "process-application", discard };
    const err = new NonRetryableError("invalid_parsed_content");

    await expect(finalizeBullMqJobFailure(job, err, { forceUnrecoverable: true })).rejects.toThrow(
      UnrecoverableError
    );
    expect(discard).toHaveBeenCalled();
  });
});
