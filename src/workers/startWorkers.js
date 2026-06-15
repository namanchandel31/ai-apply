const { logInfo, logError } = require("../utils/logger");
const { markBootPhaseComplete } = require("../observability/processLifecycle");

let workersStarted = false;
let processWorker = null;
let sendWorker = null;

/**
 * Start BullMQ consumers (background processing layer).
 */
async function startWorkers() {
  if (workersStarted) {
    return { processWorker, sendWorker };
  }

  const { registerRuntimeOwnership } = require("../runtime/runtimeOwnership");
  registerRuntimeOwnership({ role: "worker", sseGatewayOwner: false });

  const { startPostCommitSweep } = require("../realtime/postCommitPublishQueue");
  startPostCommitSweep();

  const { validateQueueSystem } = require("../queues/validateQueueSystem");
  await validateQueueSystem({ role: "worker" });

  const {
    redisRealtimeEnabled,
    ensureRealtimePublisher,
  } = require("../realtime/redisRealtimeBridge");
  if (redisRealtimeEnabled()) {
    ensureRealtimePublisher();
  }

  const processModule = require("./processApplication.worker");
  const sendModule = require("./sendApplication.worker");
  processWorker = processModule.worker;
  sendWorker = sendModule.worker;

  const { pool, startPoolMetricsLogging, POOL_INSTANCE_ID, POOL_OWNER } = require("../db");
  startPoolMetricsLogging(pool, 60_000, {
    poolInstanceId: POOL_INSTANCE_ID,
    poolOwner: POOL_OWNER,
  });

  workersStarted = true;
  logInfo("WORKERS_BOOT_COMPLETE", {
    component: "worker",
    queues: ["process-application", "send-application"],
  });

  return { processWorker, sendWorker };
}

/**
 * Gracefully close BullMQ workers.
 */
async function stopWorkers() {
  if (!workersStarted) return;

  const { markBullmqShuttingDown } = require("../queues/connection");
  markBullmqShuttingDown();

  const closes = [];
  if (processWorker) {
    closes.push(
      processWorker.close().catch((err) => {
        logError("WORKER_CLOSE_FAILED", err, { component: "worker", workerName: "process-application" });
      })
    );
  }
  if (sendWorker) {
    closes.push(
      sendWorker.close().catch((err) => {
        logError("WORKER_CLOSE_FAILED", err, { component: "worker", workerName: "send-application" });
      })
    );
  }

  await Promise.all(closes);
  processWorker = null;
  sendWorker = null;
  workersStarted = false;
  logInfo("WORKERS_SHUTDOWN_COMPLETE", { component: "worker" });
}

module.exports = { startWorkers, stopWorkers };
