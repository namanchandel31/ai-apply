const { Queue } = require("bullmq");
const config = require("../config");
const { connection } = require("./connection");
const { PROCESS_APPLICATION_QUEUE } = require("./queueConstants");

const processApplicationQueue = new Queue(PROCESS_APPLICATION_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: config.queue.PROCESS_JOB_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = { processApplicationQueue };
