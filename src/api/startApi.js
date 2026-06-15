const config = require("../config");
const { testConnection } = require("../db");
const { logInfo, logError } = require("../utils/logger");
const { markBootPhaseComplete } = require("../observability/processLifecycle");
const { createApp } = require("./createApp");

let httpServer = null;
let apiRuntimeStarted = false;

async function startApiRuntime() {
  if (apiRuntimeStarted) return;

  const { registerRuntimeOwnership } = require("../runtime/runtimeOwnership");
  const { startSseGateway } = require("../realtime/sseGateway");
  const { startSseZombieReaper } = require("../realtime/sseZombieReaper");
  const { startPostCommitSweep } = require("../realtime/postCommitPublishQueue");

  registerRuntimeOwnership({ role: "api", sseGatewayOwner: true });
  startSseGateway();
  startSseZombieReaper();
  startPostCommitSweep();
  apiRuntimeStarted = true;

  logInfo("API_RUNTIME_STARTED", {
    component: "api",
    sseGateway: true,
    recoveryLoop: true,
  });
}

/**
 * Start Express API (HTTP + realtime gateway + recovery loop).
 * @param {{ app?: import('express').Express }} [options]
 */
async function startApi(options = {}) {
  const app = options.app ?? createApp();
  const port = config.server.port;

  await startApiRuntime();

  if (httpServer) {
    return { app, server: httpServer };
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, async () => {
      try {
        logInfo("API_LISTENING", {
          component: "api",
          port,
          nodeEnv: config.server.nodeEnv,
          deploymentMode: config.queue.workerDeploymentMode(),
        });

        logInfo("LLM_PROTECTION_INITIALIZED", {
          component: "api",
          retryBudget: config.ai.LLM_GLOBAL_RETRY_BUDGET,
          circuitThreshold: config.ai.LLM_CIRCUIT_BREAKER_THRESHOLD,
          cooldownDurationMs: config.ai.LLM_CIRCUIT_BREAKER_COOLDOWN_MS,
        });

        await testConnection();

        const { validateQueueSystem } = require("../queues/validateQueueSystem");
        try {
          await validateQueueSystem({ role: "api" });
        } catch (queueErr) {
          logError("QUEUE_SYSTEM_VALIDATION_FAILED", queueErr, { component: "api" });
          if (config.queue.queueValidationStrict()) {
            throw queueErr;
          }
        }

        const { pool, startPoolMetricsLogging, POOL_INSTANCE_ID, POOL_OWNER } = require("../db");
        startPoolMetricsLogging(pool, 60_000, {
          poolInstanceId: POOL_INSTANCE_ID,
          poolOwner: POOL_OWNER,
        });

        const { recoveryLoop } = require("../jobs/recovery.job");
        recoveryLoop().catch((err) => {
          logError("RECOVERY_BOOT_ERROR", err, { component: "api" });
        });

        markBootPhaseComplete();
        logInfo("API_BOOT_COMPLETE", { component: "api", poolInstanceId: POOL_INSTANCE_ID });
        resolve({ app, server });
      } catch (err) {
        logError("API_BOOT_FAILED", err, { component: "api" });
        reject(err);
      }
    });

    server.on("error", reject);
    httpServer = server;
  });
}

async function stopApi() {
  if (!httpServer) return;

  await new Promise((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
  httpServer = null;
  logInfo("API_HTTP_CLOSED", { component: "api" });
}

module.exports = { createApp, startApi, stopApi, startApiRuntime };
