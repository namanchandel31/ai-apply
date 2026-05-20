#!/usr/bin/env node
/**
 * Verify BullMQ workers boot and Redis queues are reachable.
 * Usage: node scripts/verifyWorkerBoot.js
 */
require("dotenv").config();

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL required");
  process.exit(1);
}

if (!process.env.WORKER_MODE) {
  process.env.WORKER_MODE = "inline";
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

  const { connection } = require("../src/queues/connection");
  await connection.quit();
  process.exit(0);
}

main().catch((err) => {
  console.error("VERIFY_FAILED", err.message);
  process.exit(1);
});
