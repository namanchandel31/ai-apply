const { logInfo } = require("../utils/logger");
const { willBullMqRetry, isNonRetryableApplicationError } = require("../queues/bullmqJobFailure");
const { bullmqIsTerminalFailure } = require("./bullmqJobInspector");

/**
 * Whether application should transition to terminal failed (business truth).
 * BullMQ execution truth: only when retries exhausted or UnrecoverableError.
 */
function shouldPersistTerminalFailure(job, err, bullmqInspect = null) {
  if (job && willBullMqRetry(job, err)) {
    return false;
  }

  if (isNonRetryableApplicationError(err)) {
    return true;
  }

  if (bullmqInspect && bullmqIsTerminalFailure(bullmqInspect)) {
    return true;
  }

  if (job) {
    const maxAttempts = job.opts?.attempts ?? 3;
    if ((job.attemptsMade ?? 0) >= maxAttempts) {
      return true;
    }
  }

  return false;
}

function logFailureDecision({
  applicationId,
  jobId,
  failureReason,
  failureSource,
  bullmqState,
  workerState,
  retryBudget,
  willPersist,
  willRetry,
  err,
}) {
  logInfo("FAILURE_DECISION", {
    applicationId,
    jobId,
    failureReason,
    failureSource,
    bullmqState: bullmqState ?? null,
    workerState: workerState ?? null,
    retryBudget,
    willPersist: Boolean(willPersist),
    willRetry: Boolean(willRetry),
    error_type: err?.name,
    error_message: err?.message,
  });
}

module.exports = {
  shouldPersistTerminalFailure,
  logFailureDecision,
};
