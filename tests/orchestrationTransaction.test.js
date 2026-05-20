jest.mock("../src/db", () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));
jest.mock("../src/services/resolveResumeForAutoApply", () => ({
  resolveResumeForAutoApply: jest.fn(),
}));
jest.mock("../src/models/jdModel", () => ({ createPlaceholderJobDescription: jest.fn() }));
jest.mock("../src/models/applicationModel", () => ({ createApplication: jest.fn() }));
jest.mock("../src/models/applicationJobModel", () => ({ createJob: jest.fn() }));
jest.mock("../src/models/applicationEventModel", () => ({ recordEvent: jest.fn() }));
jest.mock("../src/queues/processApplicationQueue", () => ({
  enqueueProcessApplicationJob: jest.fn(),
}));
jest.mock("../src/utils/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const { pool } = require("../src/db");
const { resolveResumeForAutoApply } = require("../src/services/resolveResumeForAutoApply");
const { createPlaceholderJobDescription } = require("../src/models/jdModel");
const { createApplication } = require("../src/models/applicationModel");
const { createJob } = require("../src/models/applicationJobModel");
const { recordEvent } = require("../src/models/applicationEventModel");
const { enqueueProcessApplicationJob } = require("../src/queues/processApplicationQueue");
const { logError } = require("../src/utils/logger");
const { startAutoApply } = require("../src/services/applicationOrchestrationService");

function mockClient() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  return client;
}

describe("startAutoApply transaction boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveResumeForAutoApply.mockResolvedValue({
      resumeId: "resume-1",
      filePath: "/r.pdf",
      parsedJson: { name: "Test" },
    });
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    createPlaceholderJobDescription.mockResolvedValue({ jobDescriptionId: "jd-1" });
    createApplication.mockResolvedValue(undefined);
    recordEvent.mockResolvedValue(undefined);
    enqueueProcessApplicationJob.mockResolvedValue({ jobId: "bull-1" });
  });

  it("rolls back and does not enqueue when createJob fails before COMMIT", async () => {
    const client = mockClient();
    createJob.mockRejectedValueOnce(new Error("job insert failed"));

    await expect(startAutoApply(1, "JD text", "req-1")).rejects.toThrow("job insert failed");

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith("COMMIT");
    expect(enqueueProcessApplicationJob).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalledWith(
      "ENQUEUE_AFTER_COMMIT_FAILED",
      expect.anything(),
      expect.anything()
    );
    expect(client.release).toHaveBeenCalled();
  });

  it("passes resolved resumeId to createApplication", async () => {
    mockClient();
    createJob.mockResolvedValueOnce({ id: "db-job-1" });
    await startAutoApply(1, "JD text", "req-1");

    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeId: "resume-1",
        resumeSnapshotPath: "/r.pdf",
      })
    );
  });

  it("commits DB work and logs ENQUEUE_AFTER_COMMIT_FAILED when enqueue fails after COMMIT", async () => {
    const client = mockClient();
    createJob.mockResolvedValueOnce({ id: "db-job-1" });
    enqueueProcessApplicationJob.mockRejectedValueOnce(new Error("redis down"));

    await expect(startAutoApply(1, "JD text", "req-1")).rejects.toMatchObject({
      code: "ENQUEUE_AFTER_COMMIT_FAILED",
      retryable: true,
    });

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");
    expect(createApplication).toHaveBeenCalled();
    expect(createJob).toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "ENQUEUE_AFTER_COMMIT_FAILED",
      expect.any(Error),
      expect.objectContaining({ queueName: "process-application" })
    );
    expect(client.release).toHaveBeenCalled();
  });

  it("recovery path re-enqueues stuck queued jobs without bullmq id", () => {
    const fs = require("fs");
    const path = require("path");
    const recoverySrc = fs.readFileSync(
      path.join(__dirname, "../src/jobs/recovery.job.js"),
      "utf8"
    );
    expect(recoverySrc).toContain("findRecoverableStuckQueuedJobs");
    expect(recoverySrc).toContain("enqueueProcessApplicationJob");
  });
});
