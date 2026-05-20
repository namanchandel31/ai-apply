const {
  PROCESS_APPLICATION_QUEUE,
  SEND_APPLICATION_QUEUE,
  bullmqQueueForJobType,
} = require("../src/queues/queueConstants");

describe("queueConstants", () => {
  it("maps ai_process to process-application queue", () => {
    expect(bullmqQueueForJobType("ai_process")).toBe(PROCESS_APPLICATION_QUEUE);
    expect(PROCESS_APPLICATION_QUEUE).toBe("process-application");
  });

  it("maps send_email to send-application queue", () => {
    expect(bullmqQueueForJobType("send_email")).toBe(SEND_APPLICATION_QUEUE);
    expect(SEND_APPLICATION_QUEUE).toBe("send-application");
  });

  it("throws for unknown job types", () => {
    expect(() => bullmqQueueForJobType("unknown")).toThrow(/Unknown job_type/);
  });
});
