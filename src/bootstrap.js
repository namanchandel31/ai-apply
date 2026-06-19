#!/usr/bin/env node
/**
 * Combined production entrypoint: API + BullMQ workers in one process.
 * Render / single-service deployment: npm start
 *
 * Future split:
 *   API only    → node index.js
 *   Workers only → npm run worker
 */
require("dotenv").config();

const config = require("./config");
const { logInfo, logError } = require("./utils/logger");
const {
  registerProcessLifecycleHandlers,
  startRuntimeDiagnostics,
} = require("./observability/processLifecycle");
const { registerGracefulShutdown, registerShutdownHook } = require("./runtime/shutdown");
const { startApi, stopApi } = require("./api/startApi");
const { startWorkers, stopWorkers } = require("./workers/startWorkers");

registerProcessLifecycleHandlers();
startRuntimeDiagnostics(30000);
registerGracefulShutdown();

registerShutdownHook("workers", stopWorkers, { priority: 100 });
registerShutdownHook("api", stopApi, { priority: 80 });
registerShutdownHook("redis", async () => {
  const { closeBullmqQueues } = require("./queues/bullmqShutdown");
  await closeBullmqQueues();
}, { priority: 20 });
registerShutdownHook("postgres", async () => {
  const { pool } = require("./db");
  await pool.end();
}, { priority: 10 });

async function startAll() {
  const workersEnabled = process.env.ENABLE_WORKERS !== "false";

  logInfo("BOOTSTRAP_START", {
    component: "bootstrap",
    mode: "combined",
    workerMode: config.queue.workerDeploymentMode(),
    workersEnabled,
    port: config.server.port,
  });

  // COMBINED STARTUP ORDER (do not reorder):
  // 1. startWorkers() — validates Redis + starts BullMQ consumers (optional: ENABLE_WORKERS=false)
  // 2. startApi()     — validates Redis again (idempotent) + binds HTTP
  if (workersEnabled) {
    await startWorkers();
  } else {
    logInfo("WORKERS_DISABLED_BY_CONFIG", {
      component: "bootstrap",
      enableWorkers: process.env.ENABLE_WORKERS ?? "(unset)",
    });
  }

  await startApi();

  logInfo("BOOTSTRAP_READY", {
    component: "bootstrap",
    port: config.server.port,
    workersEnabled,
    workers: workersEnabled
      ? ["process-application", "send-application"]
      : [],
  });
}

if (require.main === module) {
  startAll().catch((err) => {
    logError("BOOTSTRAP_FAILED", err, { component: "bootstrap" });
    process.exit(1);
  });
}

module.exports = { startAll, startApi, startWorkers };
