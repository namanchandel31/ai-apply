const { Queue } = require("bullmq");
const config = require("../config");
const { connection } = require("./connection");
const { QUEUE_NAMES } = require("../constants/queues");

const QUEUE_NAME = QUEUE_NAMES.SEND_APPLICATION;

const sendApplicationQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: config.queue.SEND_JOB_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400,
    },
    removeOnFail: {
      age: 604800,
    },
  },
});

/**
 * Enqueues an application to be sent by the worker.
 * Uses deterministic job IDs for idempotency.
 */
async function enqueueSendJob(applicationId, userId, recipientEmail, { dbJobId } = {}) {
  const jobId = `send:application:${applicationId}`;

  const existing = await sendApplicationQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["waiting", "delayed", "active"].includes(state)) {
      return { jobId: existing.id, alreadyQueued: true };
    }
  }

  const job = await sendApplicationQueue.add(
    QUEUE_NAME,
    { applicationId, userId, recipientEmail, dbJobId },
    { jobId }
  );

  return { jobId: job.id, bullmqJobId: job.id };
}

module.exports = {
  sendApplicationQueue,
  enqueueSendJob,
  QUEUE_NAME,
};
