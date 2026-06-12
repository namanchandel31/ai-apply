const { Queue } = require("bullmq");
const config = require("../config");
const { getBullmqConnectionOptions } = require("./connection");
const { logBullmqComponentBinding } = require("../observability/redisDebugInstrumentation");
const { QUEUE_NAMES } = require("../constants/queues");

const QUEUE_NAME = QUEUE_NAMES.PROCESS_APPLICATION;

const bullmqConnection = getBullmqConnectionOptions();

logBullmqComponentBinding({
  componentType: "queue",
  componentName: QUEUE_NAME,
  connection: null,
  hypothesisId: "B",
  extra: { blocking: false, dedicatedConnection: true },
});

const processApplicationQueue = new Queue(QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: config.queue.PROCESS_JOB_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Idempotent process enqueue — deterministic BullMQ job id.
 */
async function enqueueProcessApplicationJob(applicationId, userId, { dbJobId } = {}) {
  const jobId = `process:application:${applicationId}`;

  const existing = await processApplicationQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["waiting", "delayed", "active"].includes(state)) {
      return { jobId: existing.id, bullmqJobId: existing.id, alreadyQueued: true };
    }
  }

  const job = await processApplicationQueue.add(
    QUEUE_NAME,
    { applicationId, userId, dbJobId },
    { jobId }
  );
  return { jobId: job.id, bullmqJobId: job.id };
}

module.exports = {
  processApplicationQueue,
  enqueueProcessApplicationJob,
  QUEUE_NAME,
};
