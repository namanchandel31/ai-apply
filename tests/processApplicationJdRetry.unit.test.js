const { classifyJdParseFailure, FAILURE_ACTION } = require("../src/services/jdParseFailureClassifier");
const { finalizeBullMqJobFailure } = require("../src/queues/bullmqJobFailure");
const { NonRetryableError } = require("../src/utils/errors");
const { UnrecoverableError } = require("bullmq");

describe("process application JD retry mapping", () => {
  it("maps NonRetryableError to BullMQ UnrecoverableError via finalizeBullMqJobFailure", async () => {
    const err = new NonRetryableError("invalid_parsed_content");
    err.validation = { missingFields: ["job_title"], emptyFields: [], invalidFields: [] };
    const action = classifyJdParseFailure(err);
    expect(action).toBe(FAILURE_ACTION.UNRECOVERABLE);
    const job = { id: "1", queueName: "q", discard: jest.fn().mockResolvedValue(undefined) };
    await expect(
      finalizeBullMqJobFailure(job, err, { forceUnrecoverable: true })
    ).rejects.toThrow(UnrecoverableError);
  });
});
