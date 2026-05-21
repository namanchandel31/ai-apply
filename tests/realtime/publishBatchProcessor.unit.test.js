const {
  enqueuePublishBatch,
  flushPublishBatchNow,
  resetPublishBatchForTests,
  PUBLISH_BATCH_FLUSH_MS,
} = require("../../src/realtime/publishBatchProcessor");

jest.mock("../../src/realtime/publishApplicationUpdate", () => ({
  publishApplicationUpdate: jest.fn().mockResolvedValue(undefined),
}));

const { publishApplicationUpdate } = require("../../src/realtime/publishApplicationUpdate");

describe("publishBatchProcessor", () => {
  beforeEach(() => {
    resetPublishBatchForTests();
    publishApplicationUpdate.mockClear();
  });

  it("uses 75ms flush interval constant", () => {
    expect(PUBLISH_BATCH_FLUSH_MS).toBe(75);
  });

  it("coalesces multiple enqueues for same app into one publish on flush", async () => {
    enqueuePublishBatch("app-1", "user-1", { expectedVersion: 1, publishSource: "a" });
    enqueuePublishBatch("app-1", "user-1", { expectedVersion: 2, publishSource: "b" });
    await flushPublishBatchNow();
    expect(publishApplicationUpdate).toHaveBeenCalledTimes(1);
    expect(publishApplicationUpdate).toHaveBeenCalledWith(
      "app-1",
      "user-1",
      expect.objectContaining({ expectedVersion: 2 })
    );
  });
});
