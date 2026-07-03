/**
 * Canonical BullMQ queue names — single source of truth.
 * Do not read queue names from env; scale via worker replicas, not renamed queues.
 */

const PROCESS_APPLICATION = "process-application";
const SEND_APPLICATION = "send-application";
const INTELLIGENT_SEND_WAKE = "intelligent-send-wake";

const QUEUE_NAMES = Object.freeze({
  PROCESS_APPLICATION,
  SEND_APPLICATION,
  INTELLIGENT_SEND_WAKE,
});

/** DB application_jobs.job_type → BullMQ queue */
const JOB_TYPE_TO_BULLMQ_QUEUE = Object.freeze({
  ai_process: PROCESS_APPLICATION,
  send_email: SEND_APPLICATION,
});

const ALL_BULLMQ_QUEUES = Object.freeze([
  PROCESS_APPLICATION,
  SEND_APPLICATION,
  INTELLIGENT_SEND_WAKE,
]);

function assertQueueConfiguration() {
  for (const [key, name] of Object.entries(QUEUE_NAMES)) {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error(
        `[queues] Invalid queue name for QUEUE_NAMES.${key}: must be a non-empty string`
      );
    }
  }
  for (const [jobType, queueName] of Object.entries(JOB_TYPE_TO_BULLMQ_QUEUE)) {
    if (!ALL_BULLMQ_QUEUES.includes(queueName)) {
      throw new Error(
        `[queues] job_type "${jobType}" maps to unknown queue "${queueName}"`
      );
    }
  }
}

function bullmqQueueForJobType(jobType) {
  const queue = JOB_TYPE_TO_BULLMQ_QUEUE[jobType];
  if (!queue) {
    throw new Error(`Unknown job_type for queue mapping: ${jobType}`);
  }
  return queue;
}

assertQueueConfiguration();

/** @deprecated Use PROCESS_APPLICATION — kept for existing imports */
const PROCESS_APPLICATION_QUEUE = PROCESS_APPLICATION;
/** @deprecated Use SEND_APPLICATION */
const SEND_APPLICATION_QUEUE = SEND_APPLICATION;

module.exports = {
  QUEUE_NAMES,
  PROCESS_APPLICATION,
  SEND_APPLICATION,
  PROCESS_APPLICATION_QUEUE,
  SEND_APPLICATION_QUEUE,
  JOB_TYPE_TO_BULLMQ_QUEUE,
  ALL_BULLMQ_QUEUES,
  bullmqQueueForJobType,
  assertQueueConfiguration,
};
