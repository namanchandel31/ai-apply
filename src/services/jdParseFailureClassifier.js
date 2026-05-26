const { RetryableError, NonRetryableError } = require("../utils/errors");
const { isNonRetryableApplicationError } = require("../queues/bullmqJobFailure");
const { FAILURE_OUTCOMES } = require("../domain/jd/parseOutcomes");

const FAILURE_ACTION = Object.freeze({
  RETRY: "retry",
  UNRECOVERABLE: "unrecoverable",
  DEGRADED_SUCCESS: "degraded_success",
});

/**
 * @param {Error} err
 * @param {{ parseOutcome?: string, isApplyEligible?: boolean }} context
 */
function classifyJdParseFailure(err, context = {}) {
  if (context.isApplyEligible) {
    return FAILURE_ACTION.DEGRADED_SUCCESS;
  }

  if (err instanceof RetryableError || err?.name === "RetryableError") {
    return FAILURE_ACTION.RETRY;
  }

  if (isNonRetryableApplicationError(err)) {
    return FAILURE_ACTION.UNRECOVERABLE;
  }

  if (err instanceof NonRetryableError || err?.retryable === false) {
    return FAILURE_ACTION.UNRECOVERABLE;
  }

  const msg = (err?.message || "").toLowerCase();

  if (msg.includes("timeout") || msg.includes("rate limit") || msg.includes("econnreset")) {
    return FAILURE_ACTION.RETRY;
  }
  if (msg.includes("schema_mismatch") || msg.includes("json") || msg.includes("empty response")) {
    return FAILURE_ACTION.RETRY;
  }

  return FAILURE_ACTION.RETRY;
}

function isFailureOutcome(outcome) {
  return FAILURE_OUTCOMES.has(outcome);
}

function toBullMqError(err, action) {
  if (action !== FAILURE_ACTION.UNRECOVERABLE) return err;
  const { UnrecoverableError } = require("bullmq");
  if (err instanceof UnrecoverableError) return err;
  const wrapped = new UnrecoverableError(err.message || "JD parse failed");
  wrapped.cause = err;
  wrapped.validation = err.validation;
  wrapped.parseOutcome = err.parseOutcome;
  return wrapped;
}

module.exports = {
  FAILURE_ACTION,
  classifyJdParseFailure,
  isFailureOutcome,
  toBullMqError,
};
