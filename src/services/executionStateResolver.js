const { getApplicationById } = require("../models/applicationModel");
const { getLatestJobByType } = require("../models/applicationJobModel");
const {
  inspectBullmqJob,
  bullmqHasRetryBudget,
  bullmqIsTerminalFailure,
} = require("./bullmqJobInspector");
const { willBullMqRetry } = require("../queues/bullmqJobFailure");
const { logInfo, logError } = require("../utils/logger");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

/**
 * Unified execution truth: BullMQ + DB job row + application status.
 * @param {string} applicationId
 * @param {string} userId
 * @param {{ jobType?: string, bullmqJob?: import('bullmq').Job, err?: Error }} opts
 */
async function resolveExecutionState(applicationId, userId, opts = {}) {
  const jobType = opts.jobType || "ai_process";
  const [app, dbJob, bullmq] = await Promise.all([
    getApplicationById(applicationId, userId),
    getLatestJobByType(applicationId, jobType),
    inspectBullmqJob(applicationId, jobType),
  ]);

  const willRetry =
    opts.bullmqJob && opts.err
      ? willBullMqRetry(opts.bullmqJob, opts.err)
      : bullmqHasRetryBudget(bullmq);

  return {
    applicationId,
    userId,
    jobType,
    applicationStatus: app?.application_status ?? null,
    dbJobId: dbJob?.id ?? null,
    dbJobStatus: dbJob?.status ?? null,
    dbJobLastError: dbJob?.last_error ?? null,
    bullmq,
    willBullMqRetry: willRetry,
    bullmqTerminalFailure: bullmqIsTerminalFailure(bullmq),
    applicationIsTerminal:
      app?.application_status === APPLICATION_STATUS.FAILED ||
      app?.application_status === APPLICATION_STATUS.CANCELLED ||
      app?.application_status === APPLICATION_STATUS.SENT,
  };
}

function logExecutionTimeline(event, ctx) {
  logInfo("EXECUTION_TIMELINE", {
    event,
    ...ctx,
  });
}

/**
 * Emit when business truth and BullMQ truth diverge.
 */
function assertExecutionInvariants(resolved, context = {}) {
  const violations = [];

  if (
    resolved.applicationStatus === APPLICATION_STATUS.FAILED &&
    resolved.bullmq?.jobState &&
    ["waiting", "delayed", "active"].includes(resolved.bullmq.jobState)
  ) {
    violations.push("application_failed_while_bullmq_active");
  }

  if (
    resolved.applicationStatus === APPLICATION_STATUS.FAILED &&
    resolved.willBullMqRetry
  ) {
    violations.push("application_failed_while_retries_remain");
  }

  if (violations.length) {
    logError(
      "EXECUTION_STATE_INVARIANT_BROKEN",
      new Error(violations.join(",")),
      {
        ...context,
        violations,
        applicationId: resolved.applicationId,
        applicationStatus: resolved.applicationStatus,
        bullmqState: resolved.bullmq?.jobState,
        willBullMqRetry: resolved.willBullMqRetry,
        dbJobStatus: resolved.dbJobStatus,
      }
    );
  }

  return violations;
}

module.exports = {
  resolveExecutionState,
  logExecutionTimeline,
  assertExecutionInvariants,
};
