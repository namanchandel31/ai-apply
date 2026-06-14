const { UnrecoverableError } = require("bullmq");
const { NonRetryableError, RetryableError } = require("../utils/errors");
const { logInfo } = require("../utils/logger");

/**
 * Gmail SMTP auth failures — retrying will not fix invalid/revoked app passwords.
 */
function isSmtpAuthFailure(err) {
  const msg = String(err?.message || "");
  return (
    msg.includes("BadCredentials") ||
    msg.includes("535-5.7.8") ||
    msg.includes("Username and Password not accepted")
  );
}

/**
 * True when the error must not consume BullMQ retry attempts.
 */
function isNonRetryableApplicationError(err) {
  if (!err) return false;
  if (err instanceof UnrecoverableError || err instanceof NonRetryableError) return true;
  if (err.name === "UnrecoverableError" || err.name === "NonRetryableError") return true;
  if (isSmtpAuthFailure(err)) return true;
  return false;
}

/**
 * Whether BullMQ will schedule another attempt for this failure.
 */
function willBullMqRetry(job, err) {
  if (!job) return false;
  if (isNonRetryableApplicationError(err)) return false;
  const maxAttempts = job.opts?.attempts ?? 1;
  return job.attemptsMade < maxAttempts;
}

/**
 * Stop retries immediately for non-retryable failures.
 * @param {import('bullmq').Job} job
 * @param {Error} err
 * @param {{ forceUnrecoverable?: boolean }} opts
 */
async function finalizeBullMqJobFailure(job, err, opts = {}) {
  const nonRetryable =
    opts.forceUnrecoverable || isNonRetryableApplicationError(err);

  if (!nonRetryable) {
    throw err;
  }

  if (job && typeof job.discard === "function") {
    try {
      await job.discard();
      logInfo("BULLMQ_JOB_DISCARDED", {
        bullmqJobId: job.id,
        queueName: job.queueName,
        reason: err?.message,
        error_type: err?.name,
      });
    } catch (discardErr) {
      logInfo("BULLMQ_JOB_DISCARD_SKIPPED", {
        bullmqJobId: job.id,
        message: discardErr?.message,
      });
    }
  }

  if (err instanceof UnrecoverableError) {
    throw err;
  }

  const wrapped = new UnrecoverableError(err?.message || "Non-retryable job failure");
  wrapped.cause = err;
  wrapped.originalName = err?.name;
  throw wrapped;
}

module.exports = {
  isSmtpAuthFailure,
  isNonRetryableApplicationError,
  willBullMqRetry,
  finalizeBullMqJobFailure,
};
