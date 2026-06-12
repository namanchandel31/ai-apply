const config = require("../config");
const { pingRedis: pingBullmqRedis } = require("./connection");
const { processApplicationQueue } = require("./processApplicationQueue");
const { sendApplicationQueue } = require("./sendApplicationQueue");
const {
  QUEUE_NAMES,
  ALL_BULLMQ_QUEUES,
  assertQueueConfiguration,
} = require("../constants/queues");

const PROCESS_APPLICATION_QUEUE = QUEUE_NAMES.PROCESS_APPLICATION;
const SEND_APPLICATION_QUEUE = QUEUE_NAMES.SEND_APPLICATION;
const { logInfo, logError } = require("../utils/logger");

async function pingRedis() {
  return pingBullmqRedis();
}

async function getAllQueueCounts() {
  const [processCounts, sendCounts] = await Promise.all([
    processApplicationQueue.getJobCounts(
      "waiting",
      "active",
      "failed",
      "delayed",
      "completed",
      "paused"
    ),
    sendApplicationQueue.getJobCounts(
      "waiting",
      "active",
      "failed",
      "delayed",
      "completed",
      "paused"
    ),
  ]);
  return {
    [PROCESS_APPLICATION_QUEUE]: processCounts,
    [SEND_APPLICATION_QUEUE]: sendCounts,
  };
}

async function validateQueueSystem({ role = "api" } = {}) {
  assertQueueConfiguration();

  if (!config.redis.redisUrl) {
    const err = new Error(
      "REDIS_URL is required for BullMQ (set a redis:// or rediss:// URL)"
    );
    logError("QUEUE_SYSTEM_REDIS_URL_MISSING", err, { role });
    throw err;
  }

  const workerMode = config.queue.workerDeploymentMode();
  const strict = config.queue.queueValidationStrict();

  const redisOk = await pingRedis();
  if (!redisOk) {
    const err = new Error("Redis ping failed");
    logError("QUEUE_SYSTEM_REDIS_FAILED", err, { role });
    if (strict) throw err;
    return { ok: false, redisOk: false, workerMode };
  }

  logInfo("WORKER_CONNECTED", { role, redis: "connected" });

  const counts = await getAllQueueCounts();
  for (const [queueName, metrics] of Object.entries(counts)) {
    logInfo("QUEUE_METRICS", {
      queueName,
      waiting: metrics.waiting ?? 0,
      active: metrics.active ?? 0,
      failed: metrics.failed ?? 0,
      delayed: metrics.delayed ?? 0,
      completed: metrics.completed ?? 0,
      paused: metrics.paused ?? 0,
    });
  }

  const summary = {
    event: "QUEUE_SYSTEM_READY",
    role,
    redis: "connected",
    producerProcess: PROCESS_APPLICATION_QUEUE,
    producerSend: SEND_APPLICATION_QUEUE,
    workerProcess: PROCESS_APPLICATION_QUEUE,
    workerSend: SEND_APPLICATION_QUEUE,
    workerMode,
    bullmqQueues: ALL_BULLMQ_QUEUES,
    counts,
  };

  logInfo("QUEUE_SYSTEM_READY", summary);

  if (workerMode === "separate" && role === "api") {
    logInfo("WORKER_MODE_SEPARATE", {
      message:
        "BullMQ workers are not started by the API process. Run `npm run worker` in a separate terminal.",
      workerMode,
    });
  }

  return { ok: true, redisOk: true, workerMode, counts };
}

module.exports = {
  validateQueueSystem,
  getAllQueueCounts,
  pingRedis,
};
