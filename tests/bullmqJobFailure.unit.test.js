const { UnrecoverableError } = require("bullmq");
const {
  isSmtpAuthFailure,
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

  it("detects Gmail SMTP auth failures as non-retryable", () => {
    const err = new Error(
      "Invalid login: 535-5.7.8 Username and Password not accepted. BadCredentials"
    );
    expect(isSmtpAuthFailure(err)).toBe(true);
    expect(isNonRetryableApplicationError(err)).toBe(true);
    expect(willBullMqRetry({ opts: { attempts: 5 }, attemptsMade: 0 }, err)).toBe(false);
  });

  it("finalizeBullMqJobFailure rethrows retryable generic errors for BullMQ", async () => {
    const job = { id: "j2", queueName: "send-application" };
    const err = new Error("temporary network blip");
    await expect(finalizeBullMqJobFailure(job, err)).rejects.toThrow("temporary network blip");
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
