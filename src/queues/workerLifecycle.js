const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");
const { willBullMqRetry } = require("./bullmqJobFailure");

function jobLogContext(job, { workerName, queueName }) {
  const data = job?.data || {};
  return buildLogContext({
    workerName,
    queueName,
    reqId: job?.id,
    applicationId: data.applicationId,
    userId: data.userId,
    jobId: data.dbJobId,
    attempt: job?.attemptsMade != null ? job.attemptsMade + 1 : undefined,
  });
}

/**
 * Attach standard BullMQ worker lifecycle logs (WORKER_* / JOB_*).
 */
function attachWorkerLifecycle(worker, { workerName, queueName }) {
  logInfo("WORKER_BOOTED", { workerName, queueName });

  worker.on("ready", () => {
    logInfo("WORKER_READY", { workerName, queueName });
  });

  worker.on("error", (err) => {
    logError("WORKER_ERROR", err, { workerName, queueName });
  });

  worker.on("closed", () => {
    logInfo("WORKER_CLOSED", { workerName, queueName });
  });

  worker.on("active", (job) => {
    logInfo("JOB_RECEIVED", jobLogContext(job, { workerName, queueName }));
    logInfo("JOB_STARTED", jobLogContext(job, { workerName, queueName }));
  });

  worker.on("progress", (job, progress) => {
    logInfo("JOB_PROGRESS", {
      ...jobLogContext(job, { workerName, queueName }),
      progress,
    });
  });

  worker.on("completed", (job, result) => {
    const ctx = jobLogContext(job, { workerName, queueName });
    const skipped = result?.skipped === true;
    logInfo(skipped ? "JOB_QUEUE_COMPLETED" : "JOB_COMPLETED", {
      ...ctx,
      queue_execution: "completed",
      business_workflow: skipped ? "skipped" : "completed",
      skip_reason: result?.skipReason,
    });
  });

  worker.on("failed", (job, err) => {
    const ctx = jobLogContext(job, { workerName, queueName });
    const maxAttempts = job?.opts?.attempts ?? 1;
    const willRetry = willBullMqRetry(job, err);
    if (willRetry) {
      logInfo("JOB_RETRIED", {
        ...ctx,
        maxAttempts,
        error: err?.message,
        error_type: err?.name,
        queue_execution: "retry_scheduled",
        business_workflow: "in_progress",
      });
    } else {
      logInfo("JOB_TERMINAL_FAILURE", {
        ...ctx,
        maxAttempts,
        error: err?.message,
        error_type: err?.name,
        queue_execution: "failed",
        business_workflow: "failed",
        willRetry: false,
      });
    }
    logError("JOB_FAILED", err, {
      ...ctx,
      willRetry,
      queue_execution: willRetry ? "retry_scheduled" : "failed",
      business_workflow: willRetry ? "in_progress" : "failed",
    });
  });

  worker.on("stalled", (jobId) => {
    logInfo("JOB_STALLED", { workerName, queueName, bullmqJobId: jobId });
  });

  return worker;
}

module.exports = { attachWorkerLifecycle, jobLogContext };
