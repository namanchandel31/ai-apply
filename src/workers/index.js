#!/usr/bin/env node
/**
 * Run all BullMQ workers (process + send) in a dedicated process.
 * Usage: npm run worker
 */
require("dotenv").config();

const { logInfo, logError } = require("../utils/logger");
const { validateQueueSystem } = require("../queues/validateQueueSystem");

async function bootWorkers() {
  await validateQueueSystem({ role: "worker" });
  const {
    redisRealtimeEnabled,
    ensureRealtimePublisher,
  } = require("../realtime/redisRealtimeBridge");
  if (redisRealtimeEnabled()) {
    ensureRealtimePublisher();
  }
  require("./processApplication.worker");
  require("./sendApplication.worker");
  logInfo("ALL_WORKERS_STARTED", {
    queues: ["process-application", "send-application"],
  });
}

if (require.main === module) {
  bootWorkers().catch((err) => {
    logError("WORKER_BOOT_FAILED", err);
    process.exit(1);
  });
}

module.exports = { bootWorkers };
