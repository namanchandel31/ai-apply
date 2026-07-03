const { Queue } = require("bullmq");
const config = require("../config");
const { getBullmqConnectionOptions } = require("./connection");
const { QUEUE_NAMES } = require("../constants/queues");

const QUEUE_NAME = QUEUE_NAMES.INTELLIGENT_SEND_WAKE;
const bullmqConnection = getBullmqConnectionOptions();

const intelligentSendWakeQueue = new Queue(QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});

function wakeJobId(userId) {
  return `intelligent-send:wake:${userId}`;
}

async function armIntelligentSendWake(userId, runAt = new Date()) {
  const delay = Math.max(0, new Date(runAt).getTime() - Date.now());
  const jobId = wakeJobId(userId);

  const existing = await intelligentSendWakeQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["waiting", "delayed", "active"].includes(state)) {
      await existing.remove();
    }
  }

  await intelligentSendWakeQueue.add(
    "wake",
    { userId },
    { jobId, delay }
  );
}

module.exports = {
  intelligentSendWakeQueue,
  armIntelligentSendWake,
  wakeJobId,
  QUEUE_NAME,
};
