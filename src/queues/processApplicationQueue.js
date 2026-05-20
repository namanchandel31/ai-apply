const { Queue } = require("bullmq");
const { connection } = require("./connection");
const { PROCESS_APPLICATION_QUEUE } = require("./queueConstants");

const QUEUE_NAME = PROCESS_APPLICATION_QUEUE;
// TODO: DLQ consumer — process-application-dlq when DLQ_ENABLED=true

const processApplicationQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: parseInt(process.env.PROCESS_JOB_MAX_ATTEMPTS || "3", 10),
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});

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
