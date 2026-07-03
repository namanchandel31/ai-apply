const { Worker } = require("bullmq");
const { getBullmqConnectionOptions } = require("../queues/connection");
const { QUEUE_NAMES } = require("../constants/queues");
const { attachWorkerLifecycle } = require("../queues/workerLifecycle");
const intelligentSendQueueService = require("../services/intelligentSendQueueService");
const { armIntelligentSendWake } = require("../queues/intelligentSendWakeQueue");
const sendQueueModel = require("../models/sendQueueModel");
const { SCHEDULER_STATE } = require("../constants/schedulerState");
const { logInfo } = require("../utils/logger");

const processor = async (job) => {
  const { userId } = job.data;
  if (!userId) return;

  const result = await intelligentSendQueueService.dispatchHeadIfDue(userId);
  logInfo("intelligent_send_wake", { userId, ...result });

  if (result.reason === "not_due" && result.nextDispatchAt) {
    await armIntelligentSendWake(userId, new Date(result.nextDispatchAt));
    return;
  }

  const scheduler = await sendQueueModel.getScheduler(userId);
  if (
    scheduler?.scheduler_state === SCHEDULER_STATE.ACTIVE &&
    scheduler.next_dispatch_at &&
    !result.dispatched
  ) {
    await armIntelligentSendWake(userId, new Date(scheduler.next_dispatch_at));
  }
};

const bullmqConnection = getBullmqConnectionOptions();

const worker = new Worker(QUEUE_NAMES.INTELLIGENT_SEND_WAKE, processor, {
  connection: bullmqConnection,
  concurrency: 1,
});

attachWorkerLifecycle(worker, {
  workerName: "intelligent-send-wake",
  queueName: QUEUE_NAMES.INTELLIGENT_SEND_WAKE,
});

module.exports = {
  worker,
  QUEUE_NAME: QUEUE_NAMES.INTELLIGENT_SEND_WAKE,
  processor,
};
