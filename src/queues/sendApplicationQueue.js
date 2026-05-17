const { Queue } = require("bullmq");
const { connection } = require("./connection");

const QUEUE_NAME = "send-application";

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
async function enqueueSendJob(applicationId, userId, recipientEmail) {
  const jobId = `application:${applicationId}`; // Deterministic ID
  
  const job = await sendApplicationQueue.add(
    QUEUE_NAME,
    { applicationId, userId, recipientEmail },
    { jobId }
  );

  return { jobId: job.id };
}

module.exports = {
  sendApplicationQueue,
  enqueueSendJob,
  QUEUE_NAME,
};
