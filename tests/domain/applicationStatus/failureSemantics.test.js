const {
  isWorkflowFailed,
  isExecutionAttemptFailed,
} = require("../../../src/domain/applicationStatus/failureSemantics");
const {
  APPLICATION_STATUS,
  JOB_STATUS,
} = require("../../../src/domain/applicationStatus/constants/uiStatuses");

describe("failureSemantics", () => {
  it("failed job + draft application after retry transition is not workflow failed", () => {
    expect(isExecutionAttemptFailed(JOB_STATUS.FAILED)).toBe(true);
    expect(isWorkflowFailed(APPLICATION_STATUS.DRAFT)).toBe(false);
  });

  it("failed job + failed application_status means both layers failed", () => {
    expect(isExecutionAttemptFailed(JOB_STATUS.FAILED)).toBe(true);
    expect(isWorkflowFailed(APPLICATION_STATUS.FAILED)).toBe(true);
  });

  it("superseded failed job does not imply workflow failed when app is draft with newer queued job", () => {
    const historicalFailedJob = { status: JOB_STATUS.FAILED };
    const latestQueuedJob = { status: JOB_STATUS.QUEUED };
    const applicationStatus = APPLICATION_STATUS.DRAFT;

    expect(isExecutionAttemptFailed(historicalFailedJob.status)).toBe(true);
    expect(isExecutionAttemptFailed(latestQueuedJob.status)).toBe(false);
    expect(isWorkflowFailed(applicationStatus)).toBe(false);
  });

  it("completed job is not an execution failure", () => {
    expect(isExecutionAttemptFailed(JOB_STATUS.COMPLETED)).toBe(false);
  });
});
