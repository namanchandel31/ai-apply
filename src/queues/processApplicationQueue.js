const { Queue } = require("bullmq");
const config = require("../config");
const { connection } = require("./connection");
const { QUEUE_NAMES } = require("../constants/queues");

const QUEUE_NAME = QUEUE_NAMES.PROCESS_APPLICATION;

const processApplicationQueue = new Queue(QUEUE_NAME, {
  connection,
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
