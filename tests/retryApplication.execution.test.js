jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("../src/models/applicationModel", () => ({
  getApplicationById: jest.fn(),
  transitionApplicationState: jest.fn(),
}));
jest.mock("../src/models/applicationJobModel", () => ({
  createJob: jest.fn(),
  hasActiveJob: jest.fn(),
  hasCompletedSendJob: jest.fn(),
  getLatestJobByType: jest.fn(),
}));
jest.mock("../src/models/applicationEventModel", () => ({
  recordEvent: jest.fn(),
}));
jest.mock("../src/queues/processApplicationQueue", () => ({
  enqueueProcessApplicationJob: jest.fn().mockResolvedValue({ jobId: "bull-1" }),
}));
jest.mock("../src/queues/sendApplicationQueue", () => ({
  enqueueSendJob: jest.fn().mockResolvedValue({ jobId: "bull-2" }),
}));

const { pool } = require("../src/db");
const { getApplicationById, transitionApplicationState } = require("../src/models/applicationModel");
const {
  createJob,
  hasActiveJob,
  getLatestJobByType,
} = require("../src/models/applicationJobModel");
const { recordEvent } = require("../src/models/applicationEventModel");
const { retryApplication } = require("../src/services/applicationCommandService");
const { APPLICATION_STATUS } = require("../src/domain/applicationStatus/constants/uiStatuses");

describe("retryApplication execution safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({});
    recordEvent.mockResolvedValue(undefined);
    hasActiveJob.mockResolvedValue(false);
    getLatestJobByType.mockResolvedValue({ id: "old-job-1" });
    createJob.mockResolvedValue({ id: "new-job-1" });
  });

  it("rejects when active job exists", async () => {
    hasActiveJob.mockResolvedValueOnce(true);
    getApplicationById.mockResolvedValue({
      id: "app-1",
      application_status: APPLICATION_STATUS.FAILED,
      review_reason: null,
      email_subject: null,
      retry_count: 1,
    });

    await expect(retryApplication("user-1", "app-1", "req-1")).rejects.toMatchObject({
      code: "RETRY_ALREADY_IN_FLIGHT",
    });
    expect(createJob).not.toHaveBeenCalled();
  });

  // After workflow failed, retry inserts a new job row; prior failed job row stays failed (execution history).
  it("creates new job row and records retry metadata when workflow was failed", async () => {
    getApplicationById.mockResolvedValue({
      id: "app-1",
      application_status: APPLICATION_STATUS.FAILED,
      review_reason: null,
      email_subject: null,
      retry_count: 2,
    });
    transitionApplicationState.mockResolvedValue({ ok: true, row: {} });

    await retryApplication("user-1", "app-1", "req-1");

    expect(createJob).toHaveBeenCalledWith({
      applicationId: "app-1",
      jobType: "ai_process",
      status: "queued",
    });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "retry_requested",
        metadata: expect.objectContaining({
          attemptNumber: 3,
          retrySource: "user",
          previousJobId: "old-job-1",
        }),
      })
    );
  });
});
