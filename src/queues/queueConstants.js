/**
 * Canonical BullMQ queue names and DB application_jobs.job_type values.
 * BullMQ queue names and job_type are different concepts — do not conflate in logs.
 */
const PROCESS_APPLICATION_QUEUE = "process-application";
const SEND_APPLICATION_QUEUE = "send-application";

/** DB row job_type → BullMQ queue that consumes it */
const JOB_TYPE_TO_BULLMQ_QUEUE = {
  ai_process: PROCESS_APPLICATION_QUEUE,
  send_email: SEND_APPLICATION_QUEUE,
};

const ALL_BULLMQ_QUEUES = [PROCESS_APPLICATION_QUEUE, SEND_APPLICATION_QUEUE];

function bullmqQueueForJobType(jobType) {
  const queue = JOB_TYPE_TO_BULLMQ_QUEUE[jobType];
  if (!queue) {
    throw new Error(`Unknown job_type for queue mapping: ${jobType}`);
  }
  return queue;
}

module.exports = {
  PROCESS_APPLICATION_QUEUE,
  SEND_APPLICATION_QUEUE,
  JOB_TYPE_TO_BULLMQ_QUEUE,
  ALL_BULLMQ_QUEUES,
  bullmqQueueForJobType,
};
