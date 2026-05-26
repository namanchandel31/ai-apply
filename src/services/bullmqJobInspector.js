const { processApplicationQueue } = require("../queues/processApplicationQueue");
const { sendApplicationQueue } = require("../queues/sendApplicationQueue");
const config = require("../config");

function bullmqJobIdFor(applicationId, jobType) {
  if (jobType === "ai_process") return `process:application:${applicationId}`;
  if (jobType === "send_email") return `send:application:${applicationId}`;
  return null;
}

function queueForJobType(jobType) {
  if (jobType === "ai_process") return processApplicationQueue;
  if (jobType === "send_email") return sendApplicationQueue;
  return null;
}

function maxAttemptsForJobType(jobType) {
  if (jobType === "ai_process") return config.queue.PROCESS_JOB_MAX_ATTEMPTS;
  if (jobType === "send_email") return config.queue.SEND_JOB_MAX_ATTEMPTS;
  return 3;
}

/**
 * Read BullMQ execution truth for an application job (no DB mutation).
 * @param {string} applicationId
 * @param {"ai_process"|"send_email"} jobType
 */
async function inspectBullmqJob(applicationId, jobType) {
  const deterministicId = bullmqJobIdFor(applicationId, jobType);
  const queue = queueForJobType(jobType);
  if (!deterministicId || !queue) {
    return {
      jobExists: false,
      deterministicId: null,
      jobState: null,
      attemptsMade: null,
      maxAttempts: maxAttemptsForJobType(jobType),
    };
  }

  const job = await queue.getJob(deterministicId);
  if (!job) {
    return {
      jobExists: false,
      deterministicId,
      jobState: null,
      attemptsMade: null,
      maxAttempts: maxAttemptsForJobType(jobType),
    };
  }

  const jobState = await job.getState();
  return {
    jobExists: true,
    deterministicId,
    bullmqJobId: job.id,
    jobState,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts?.attempts ?? maxAttemptsForJobType(jobType),
    failedReason: job.failedReason || null,
    finishedOn: job.finishedOn || null,
    processedOn: job.processedOn || null,
  };
}

/**
 * True when BullMQ still has retry budget for this job.
 */
function bullmqHasRetryBudget(bullmq) {
  if (!bullmq?.jobExists) return false;
  const max = bullmq.maxAttempts ?? 3;
  const made = bullmq.attemptsMade ?? 0;
  if (["completed"].includes(bullmq.jobState)) return false;
  if (bullmq.jobState === "failed") {
    return made < max;
  }
  if (["waiting", "delayed", "active"].includes(bullmq.jobState)) return true;
  return made < max;
}

/**
 * True when BullMQ considers this execution terminal (failed, no retries left).
 */
function bullmqIsTerminalFailure(bullmq) {
  if (!bullmq?.jobExists) return false;
  if (bullmq.jobState !== "failed") return false;
  const max = bullmq.maxAttempts ?? 3;
  return (bullmq.attemptsMade ?? 0) >= max;
}

module.exports = {
  bullmqJobIdFor,
  inspectBullmqJob,
  bullmqHasRetryBudget,
  bullmqIsTerminalFailure,
  maxAttemptsForJobType,
};
