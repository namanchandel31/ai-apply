#!/usr/bin/env node
/**
 * Worker-only entrypoint (local: npm run worker).
 * Production combined mode uses src/bootstrap.js instead.
 */
require("dotenv").config();

const { logError } = require("../utils/logger");
const {
  registerProcessLifecycleHandlers,
  startRuntimeDiagnostics,
  markBootPhaseComplete,
} = require("../observability/processLifecycle");
const { registerGracefulShutdown, registerShutdownHook } = require("../runtime/shutdown");
const { startWorkers, stopWorkers } = require("./startWorkers");

registerProcessLifecycleHandlers();
startRuntimeDiagnostics(30000);
registerGracefulShutdown();
registerShutdownHook("workers", stopWorkers, { priority: 100 });
registerShutdownHook("redis", async () => {
  const { closeBullmqQueues } = require("../queues/connection");
  const { logLifecyclePhase } = require("../observability/redisDebugInstrumentation");
  logLifecyclePhase("redis_shutdown_hook_start", "D");
  await closeBullmqQueues();
  logLifecyclePhase("redis_shutdown_hook_complete", "D");
}, { priority: 20 });
registerShutdownHook("postgres", async () => {
  const { pool } = require("../db");
  await pool.end();
}, { priority: 10 });

async function main() {
  await startWorkers();
  markBootPhaseComplete();
}

if (require.main === module) {
  main().catch((err) => {
    logError("WORKER_BOOT_FAILED", err, { component: "worker" });
    process.exit(1);
  });
}

module.exports = { startWorkers, stopWorkers, main };
