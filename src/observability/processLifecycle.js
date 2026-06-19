const { logger, logError, logInfo } = require("../utils/logger");
const { logNetworkError } = require("./networkError");
const {
  isRecoverableInfraError,
  isFatalApplicationError,
  isFatalBootstrapError,
} = require("../utils/pgErrors");
const { metrics } = require("./orchestrationMetrics");

let diagnosticsTimer = null;
let handlersRegistered = false;
let bootPhaseComplete = false;

function markBootPhaseComplete() {
  bootPhaseComplete = true;
}

function isBootPhaseComplete() {
  return bootPhaseComplete;
}

function inferSubsystemFromStack(err) {
  const stack = err?.stack || "";
  if (stack.includes("ioredis") || stack.includes("bullmq")) return "bullmq_redis";
  if (stack.includes("redisRealtimeBridge") || stack.includes("realtimeDispatch")) {
    return "redis_pubsub";
  }
  if (stack.includes("gemini.provider") || stack.includes("generativelanguage")) {
    return "gemini_fetch";
  }
  if (stack.includes("openai") || stack.includes("openaiCompatibleCore")) {
    return "openai_sdk";
  }
  if (stack.includes("sseSafeWrite") || stack.includes("realtimeController")) {
    return "sse";
  }
  if (stack.includes("node:internal/deps/undici") || stack.includes("undici")) {
    return "undici_fetch";
  }
  if (stack.includes("pg") || stack.includes("postgres")) return "postgres";
  return "unknown";
}

function containRecoverableError(phase, err, extra = {}) {
  const subsystem = inferSubsystemFromStack(err);
  logNetworkError(subsystem, err, { phase, ...extra });
  metrics.increment("runtime.infra_error_contained", { subsystem, phase });
  logger.warn(
    {
      event: "RECOVERABLE_INFRA_CONTAINED",
      phase,
      subsystem,
      error_code: err?.code,
      error_message: err?.message,
    },
    "Contained recoverable infra error — process continues"
  );
}

function fatalExit(phase, err, extra = {}) {
  const subsystem = inferSubsystemFromStack(err);
  logger.fatal(
    {
      event: "UNCAUGHT_EXCEPTION",
      phase,
      subsystem,
      err,
      error_code: err?.code,
      error_message: err?.message,
      stack: err?.stack,
      ...extra,
    },
    "Uncaught exception"
  );
  process.exit(1);
}

function handleUncaughtError(err, phase = "uncaught_exception") {
  if (isRecoverableInfraError(err)) {
    containRecoverableError(phase, err);
    return;
  }
  if (isFatalApplicationError(err)) {
    fatalExit(phase, err, { reason: "fatal_application" });
    return;
  }
  if (!bootPhaseComplete && isFatalBootstrapError(err)) {
    fatalExit(phase, err, { reason: "fatal_bootstrap" });
    return;
  }
  fatalExit(phase, err, { reason: "unclassified_fatal" });
}

function registerProcessLifecycleHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  process.on("unhandledRejection", (reason, promise) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    if (isRecoverableInfraError(err)) {
      containRecoverableError("unhandled_rejection", err, {
        promiseHint: promise ? "provided" : "none",
      });
      return;
    }
    logError("UNHANDLED_REJECTION", err, {
      subsystem: inferSubsystemFromStack(err),
      error_code: err.code,
      error_message: err.message,
      recoverable: false,
    });
    if (isFatalApplicationError(err)) {
      fatalExit("unhandled_rejection", err, { reason: "fatal_application" });
    }
  });

  process.on("uncaughtException", (err) => {
    handleUncaughtError(err, "uncaught_exception");
  });
}

async function collectRuntimeDiagnostics() {
  const diag = {
    pid: process.pid,
    activeSseConnections: 0,
    redisConnected: false,
    redisStatus: "unknown",
    queueDepth: null,
    poolTotal: 0,
    poolIdle: 0,
    poolWaiting: 0,
    poolInstanceId: null,
    activeWorkers: "unknown",
  };

  try {
    const { getConnectionCount } = require("../realtime/sseConnectionRegistry");
    diag.activeSseConnections = getConnectionCount();
  } catch (_) {
    /* ignore */
  }

  try {
    const { getRedisHealthStatus } = require("../queues/connection");
    const health = await getRedisHealthStatus();
    diag.redisConnected = health.connected;
    diag.redisStatus = health.status;
  } catch (_) {
    /* ignore */
  }

  try {
    const { getAllQueueCounts } = require("../queues/validateQueueSystem");
    diag.queueDepth = await getAllQueueCounts();
  } catch (_) {
    /* ignore */
  }

  try {
    const { pool, getPoolMetrics, POOL_INSTANCE_ID } = require("../db");
    const m = getPoolMetrics(pool);
    diag.poolTotal = m.poolTotal;
    diag.poolIdle = m.poolIdle;
    diag.poolWaiting = m.poolWaiting;
    diag.poolInstanceId = POOL_INSTANCE_ID;
    const { metrics: mets } = require("./orchestrationMetrics");
    mets.gauge("db.pool.waiting", m.poolWaiting);
    mets.gauge("db.pool.total", m.poolTotal);
    mets.gauge("db.pool.idle", m.poolIdle);
  } catch (_) {
    /* ignore */
  }

  try {
    const config = require("../config");
    diag.activeWorkers = config.queue.shouldRunInlineWorkers() ? "inline" : "separate";
  } catch (_) {
    /* ignore */
  }

  return diag;
}

function startRuntimeDiagnostics(intervalMs = 30000) {
  const config = require("../config");
  if (config.server.isProduction) return;
  if (diagnosticsTimer) return;

  const tick = async () => {
    try {
      const snapshot = await collectRuntimeDiagnostics();
      logInfo("RUNTIME_DIAGNOSTICS", snapshot);
    } catch (err) {
      logError("RUNTIME_DIAGNOSTICS_FAILED", err);
    }
  };

  void tick();
  diagnosticsTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  if (typeof diagnosticsTimer.unref === "function") {
    diagnosticsTimer.unref();
  }
}

function resetRuntimeDiagnosticsForTests() {
  if (diagnosticsTimer) {
    clearInterval(diagnosticsTimer);
    diagnosticsTimer = null;
  }
}

module.exports = {
  registerProcessLifecycleHandlers,
  startRuntimeDiagnostics,
  resetRuntimeDiagnosticsForTests,
  collectRuntimeDiagnostics,
  inferSubsystemFromStack,
  markBootPhaseComplete,
  isBootPhaseComplete,
  handleUncaughtError,
};
