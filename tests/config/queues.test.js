const {
  QUEUE_NAMES,
  assertQueueConfiguration,
} = require("../../src/constants/queues");

describe("queue constants", () => {
  it("defines non-empty BullMQ queue names", () => {
    assertQueueConfiguration();
    expect(QUEUE_NAMES.PROCESS_APPLICATION).toBe("process-application");
    expect(QUEUE_NAMES.SEND_APPLICATION).toBe("send-application");
  });

  it("processApplication.worker uses QUEUE_NAMES for Worker", () => {
    const { QUEUE_NAME } = require("../../src/workers/processApplication.worker");
    expect(QUEUE_NAME).toBe(QUEUE_NAMES.PROCESS_APPLICATION);
  });
});
