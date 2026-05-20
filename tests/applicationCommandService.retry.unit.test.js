jest.mock("../src/db", () => ({ pool: { query: jest.fn() } }));
jest.mock("../src/models/applicationModel", () => ({
  getApplicationById: jest.fn(),
  transitionApplicationState: jest.fn(),
}));
jest.mock("../src/models/applicationJobModel", () => ({
  createJob: jest.fn(),
  hasActiveJob: jest.fn().mockResolvedValue(false),
  hasCompletedSendJob: jest.fn().mockResolvedValue(false),
  getLatestJobByType: jest.fn().mockResolvedValue(null),
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
const { createJob } = require("../src/models/applicationJobModel");
const { recordEvent } = require("../src/models/applicationEventModel");
const { enqueueProcessApplicationJob } = require("../src/queues/processApplicationQueue");
const { retryApplication } = require("../src/services/applicationCommandService");
const { APPLICATION_STATUS } = require("../src/domain/applicationStatus/constants/uiStatuses");

describe("retryApplication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({});
    recordEvent.mockResolvedValue(undefined);
    createJob.mockResolvedValue({ id: "job-db-1" });
  });

  it("uses CAS when resetting failed application to draft", async () => {
    getApplicationById.mockResolvedValue({
      id: "app-1",
      application_status: APPLICATION_STATUS.FAILED,
      review_reason: null,
      email_subject: null,
    });
    transitionApplicationState.mockResolvedValue({ ok: true, row: {} });

    const result = await retryApplication("user-1", "app-1", "req-1");

    expect(transitionApplicationState).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({
        applicationId: "app-1",
        expectedStatus: APPLICATION_STATUS.FAILED,
        nextStatus: APPLICATION_STATUS.DRAFT,
        orchestrationBump: "revive_with_transition",
      })
    );
    expect(enqueueProcessApplicationJob).toHaveBeenCalled();
    expect(result.status).toBe(APPLICATION_STATUS.DRAFT);
  });
});
