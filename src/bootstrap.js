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
  logInfo("BOOTSTRAP_START", {
    component: "bootstrap",
    mode: "combined",
    workerMode: config.queue.workerDeploymentMode(),
    port: config.server.port,
  });

  await startWorkers();
  await startApi();

  logInfo("BOOTSTRAP_READY", {
    component: "bootstrap",
    port: config.server.port,
    workers: ["process-application", "send-application"],
  });
}

if (require.main === module) {
  startAll().catch((err) => {
    logError("BOOTSTRAP_FAILED", err, { component: "bootstrap" });
    process.exit(1);
  });
}

module.exports = { startAll, startApi, startWorkers };
