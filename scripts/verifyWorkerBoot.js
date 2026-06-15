#!/usr/bin/env node
/**
 * Verify BullMQ workers boot and Redis queues are reachable.
 * Usage: node scripts/verifyWorkerBoot.js
 */
require("dotenv").config();
const config = require("../src/config");

if (!config.redis.redisUrl) {
  console.error("REDIS_URL required");
  process.exit(1);
}

async function main() {
  require("../src/workers/processApplication.worker");
  require("../src/workers/sendApplication.worker");

  const { validateQueueSystem } = require("../src/queues/validateQueueSystem");
  const result = await validateQueueSystem({ role: "verify" });

  console.log("VERIFY_OK", JSON.stringify({
    workerMode: result.workerMode,
    redisOk: result.redisOk,
    processWaiting: result.counts?.["process-application"]?.waiting ?? null,
    sendWaiting: result.counts?.["send-application"]?.waiting ?? null,
  }));

  const { worker: processWorker } = require("../src/workers/processApplication.worker");
  const { worker: sendWorker } = require("../src/workers/sendApplication.worker");
  const { closeBullmqQueues } = require("../src/queues/bullmqShutdown");

  await Promise.all([processWorker.close(), sendWorker.close()]);
  await closeBullmqQueues();
  process.exit(0);
}

main().catch((err) => {
  console.error("VERIFY_FAILED", err.message);
  process.exit(1);
});
