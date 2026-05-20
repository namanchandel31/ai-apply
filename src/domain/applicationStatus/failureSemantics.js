const {
  APPLICATION_STATUS,
  JOB_STATUS,
} = require("./constants/uiStatuses");

/**
 * Workflow-level failure on applications.application_status.
 * Means the business workflow reached an unrecoverable automation failure state.
 * Distinct from a single failed execution attempt on application_jobs.
 */
function isWorkflowFailed(applicationStatus) {
  return applicationStatus === APPLICATION_STATUS.FAILED;
}

/**
 * Execution-attempt failure on application_jobs.status.
 * Historical row — immutable. Retry creates a new job row; does not imply workflow-final.
 */
function isExecutionAttemptFailed(jobStatus) {
  return jobStatus === JOB_STATUS.FAILED;
}

module.exports = {
  isWorkflowFailed,
  isExecutionAttemptFailed,
};
