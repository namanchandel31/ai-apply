const { logInfo, logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

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

  worker.on("completed", (job) => {
    logInfo("JOB_COMPLETED", jobLogContext(job, { workerName, queueName }));
  });

  worker.on("failed", (job, err) => {
    const ctx = jobLogContext(job, { workerName, queueName });
    const maxAttempts = job?.opts?.attempts ?? 1;
    const willRetry = job && job.attemptsMade < maxAttempts;
    if (willRetry) {
      logInfo("JOB_RETRIED", { ...ctx, maxAttempts, error: err?.message });
    }
    logError("JOB_FAILED", err, { ...ctx, willRetry });
  });

  worker.on("stalled", (jobId) => {
    logInfo("JOB_STALLED", { workerName, queueName, bullmqJobId: jobId });
  });

  return worker;
}

module.exports = { attachWorkerLifecycle, jobLogContext };
