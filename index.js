/**
 * API-only entrypoint (local dev: npm run dev).
 * Workers: npm run worker | Combined: npm run start:all
 */
require("dotenv").config();

const {
  registerProcessLifecycleHandlers,
  startRuntimeDiagnostics,
} = require("./src/observability/processLifecycle");
const { registerGracefulShutdown, registerShutdownHook } = require("./src/runtime/shutdown");
const { createApp } = require("./src/api/createApp");
const { startApi, stopApi } = require("./src/api/startApi");

registerProcessLifecycleHandlers();
startRuntimeDiagnostics(30000);
registerGracefulShutdown();
registerShutdownHook("api", stopApi, { priority: 80 });
registerShutdownHook("redis", async () => {
  const { closeBullmqQueues } = require("./src/queues/bullmqShutdown");
  await closeBullmqQueues();
}, { priority: 20 });
registerShutdownHook("postgres", async () => {
  const { pool } = require("./src/db");
  await pool.end();
}, { priority: 10 });

const app = createApp();

if (require.main === module) {
  startApi({ app }).catch((err) => {
    const { logError } = require("./src/utils/logger");
    logError("API_START_FAILED", err, { component: "api" });
    process.exit(1);
  });
}

module.exports = app;
