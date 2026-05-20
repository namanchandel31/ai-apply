const { Queue } = require("bullmq");
const { connection } = require("./connection");
const { SEND_APPLICATION_QUEUE } = require("./queueConstants");

const QUEUE_NAME = SEND_APPLICATION_QUEUE;

const sendApplicationQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: parseInt(process.env.MAX_PROCESSING_ATTEMPTS || "5"),
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days (acts as interim DLQ)
    },
  },
});

/**
 * Enqueues an application to be sent by the worker.
 * Uses deterministic job IDs for idempotency.
 */
/**
 * Idempotent send enqueue — deterministic BullMQ job id.
 * TODO: DLQ — send-application-dlq when DLQ_ENABLED=true
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
