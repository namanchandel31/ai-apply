require("dotenv").config();
const config = require("./src/config");
const path = require("path");
const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const { testConnection } = require("./src/db");
const { logger, logInfo, logError } = require("./src/utils/logger");
const {
  registerProcessLifecycleHandlers,
  startRuntimeDiagnostics,
} = require("./src/observability/processLifecycle");

registerProcessLifecycleHandlers();
startRuntimeDiagnostics(30000);
const tracingMiddleware = require("./src/middlewares/tracing");

const app = express();
const PORT = config.server.port;

// ---------------------------------------------------------------------------
// Global middleware — order matters
// ---------------------------------------------------------------------------

// 1. Tracing — must be first so req.requestId is available to all downstream handlers
app.use(tracingMiddleware);

// 2. Structured HTTP request/response logging via pino-http
app.use(pinoHttp({
  logger,
  // Assign the tracing requestId to pino-http's genReqId so logs are correlated
  genReqId: (req) => req.requestId,
  autoLogging: {
    ignore: (req) => {
      const pathOnly = (req.url || "").split("?")[0];
      if (pathOnly === "/health") return true;
      if (req.method !== "GET") return false;
      if (pathOnly === "/api/user/setup-status" || pathOnly === "/api/applications") {
        return true;
      }
      if (/^\/api\/applications\/[^/]+\/status$/.test(pathOnly)) {
        return true;
      }
      return false;
    },
  },
  customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : "info"),
}));

// 3. Standard body parsers
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Rate limit middleware (tiered)
// ---------------------------------------------------------------------------

const { applyRateLimit, uploadRateLimit, readRateLimit, autoApplyRateLimit } = require("./src/middlewares/rateLimitMiddleware");

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const authRoutes       = require("./src/routes/authRoutes");
const resumeRoutes     = require("./src/routes/resumeRoutes");
const jdRoutes         = require("./src/routes/jdRoutes");
const applyRoutes      = require("./src/routes/applyRoutes");
const credentialRoutes = require("./src/routes/credentialRoutes");
const sendRoutes       = require("./src/routes/sendRoutes");
const autoApplyRoutes  = require("./src/routes/autoApplyRoutes");
const applicationRoutes = require("./src/routes/applicationRoutes");
const realtimeRoutes = require("./src/routes/realtimeRoutes");
const orchestrationRoutes = require("./src/routes/orchestrationRoutes");
const userRoutes       = require("./src/routes/userRoutes");
const aiRoutes         = require("./src/routes/aiRoutes");

// ---------------------------------------------------------------------------
// Swagger UI — development only
// Playground: http://localhost:5000/docs
// OpenAPI spec: http://localhost:5000/openapi.json
// ---------------------------------------------------------------------------

if (!config.server.isProduction) {
  const { swaggerUi, swaggerSpec } = require("./src/docs/swagger");

  // Swagger UI playground — searchable, JWT persists across page refreshes
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { persistAuthorization: true },
  }));

  // Raw OpenAPI JSON spec — import into Postman, SDK generators, AI tooling
  app.get("/openapi.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// Auth (no rate limit — handled internally)
app.use("/auth", authRoutes);

// Upload routes — 20 req/min per user
app.use("/api", uploadRateLimit, resumeRoutes);
app.use("/api", uploadRateLimit, jdRoutes);

// Apply + Send routes — 10 req/min per user (LLM + SMTP cost per request)
app.use("/api/apply", applyRateLimit, applyRoutes);
app.use("/api",       applyRateLimit, sendRoutes);

// Credential management — read tier (relatively cheap)
app.use("/api", credentialRoutes);

// Auto-Apply + User Defaults
app.use("/api", autoApplyRateLimit, autoApplyRoutes);
app.use("/api", readRateLimit, applicationRoutes);
app.use("/api", realtimeRoutes);
app.use("/api", orchestrationRoutes);
app.use("/api", readRateLimit, userRoutes);
app.use("/api", readRateLimit, aiRoutes);

// Internal Queue Health
app.get("/internal/queue-health", async (req, res) => {
  const apiKey = req.headers["x-internal-api-key"];
  if (apiKey !== config.auth.internalApiKey) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { getQueueHealth } = require("./src/services/queueHealthService");
    const health = await getQueueHealth();
    return res.json({ success: true, health });
  } catch (err) {
    logError("QUEUE_HEALTH_ERROR", err);
    return res.status(500).json({ success: false, message: "Failed to fetch queue health" });
  }
});

// Lightweight cache for provider health (2s TTL)
// Note: Eventual consistency is acceptable for this operational endpoint.
// The cache prevents aggressive polling from consuming CPU resources.
let cachedProviderHealth = null;
let lastProviderHealthFetch = 0;

// Internal Provider Health (LLM Circuit Breaker & Metrics)
app.get("/internal/provider-health", (req, res) => {
  const apiKey = req.headers["x-internal-api-key"];
  if (apiKey !== config.auth.internalApiKey) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const now = Date.now();
  if (cachedProviderHealth && (now - lastProviderHealthFetch < 2000)) {
    return res.json({ success: true, version: 1, cached: true, health: cachedProviderHealth });
  }

  try {
    const llmProtection = require("./src/services/llmProtection");
    cachedProviderHealth = llmProtection.getMetrics();
    lastProviderHealthFetch = now;
    
    return res.json({ success: true, version: 1, cached: false, health: cachedProviderHealth });
  } catch (err) {
    logError("PROVIDER_HEALTH_ERROR", err);
    return res.status(500).json({ success: false, message: "Failed to fetch provider health" });
  }
});

// ---------------------------------------------------------------------------
// Health check (no auth, no rate limit, suppressed from logs above)
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /health:
 *   get:
 *     operationId: healthCheck
 *     tags: [System]
 *     summary: Service liveness check
 *     description: Returns service health status. Used by deployment probes and uptime monitors.
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             example:
 *               status: "ok"
 *               timestamp: "2026-05-16T08:30:00.000Z"
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Web UI (static SPA)
// ---------------------------------------------------------------------------

const { SPA_FALLBACK_PATTERN } = require("./src/utils/spaFallback");
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get(SPA_FALLBACK_PATTERN, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---------------------------------------------------------------------------
// Global error handler — catch-all for unhandled errors thrown by middleware
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const { buildLogContext } = require("./src/utils/buildLogContext");
  const { sendError } = require("./src/utils/httpErrorResponse");
  logError(
    "UNHANDLED_REQUEST_ERROR",
    err,
    buildLogContext({
      reqId: req.requestId,
      route: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
    })
  );
  return sendError(res, {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
    retryable: false,
  });
});

// ---------------------------------------------------------------------------
// Worker & Recovery
// ---------------------------------------------------------------------------

const workersInlineEnabled = config.queue.shouldRunInlineWorkers();

if (workersInlineEnabled) {
  require("./src/workers/processApplication.worker");
  require("./src/workers/sendApplication.worker");
  logInfo("inline_workers_started", {
    workerMode: config.queue.workerDeploymentMode(),
    queues: ["process-application", "send-application"],
  });
}

const { recoveryLoop } = require("./src/jobs/recovery.job");
const { registerRuntimeOwnership } = require("./src/runtime/runtimeOwnership");
const { startSseGateway } = require("./src/realtime/sseGateway");
const { startSseZombieReaper } = require("./src/realtime/sseZombieReaper");

registerRuntimeOwnership({ role: "api", sseGatewayOwner: true });
startSseGateway();
startSseZombieReaper();

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, async () => {
    logInfo("server_start", {
      port: PORT,
      workerMode: config.queue.workerDeploymentMode(),
      workersInlineEnabled,
      workersRequired: ["process-application", "send-application"],
    });

    logInfo("LLM_PROTECTION_INITIALIZED", {
      retryBudget: config.ai.LLM_GLOBAL_RETRY_BUDGET,
      circuitThreshold: config.ai.LLM_CIRCUIT_BREAKER_THRESHOLD,
      cooldownDurationMs: config.ai.LLM_CIRCUIT_BREAKER_COOLDOWN_MS,
      mode: "process-local",
    });

    logInfo("TIMEOUT_CONFIG_INITIALIZED", {
      controllerTimeoutMs: 90000,
      llmTimeoutMs: config.ai.LLM_TIMEOUT_MS,
      maxRetryAttempts: config.ai.LLM_MAX_ATTEMPTS,
    });

    await testConnection();

    try {
      const { validateQueueSystem } = require("./src/queues/validateQueueSystem");
      await validateQueueSystem({ role: "api" });
    } catch (queueErr) {
      logError("QUEUE_SYSTEM_VALIDATION_FAILED", queueErr);
      if (config.queue.queueValidationStrict()) {
        process.exit(1);
      }
    }

    const { pool, startPoolMetricsLogging, POOL_INSTANCE_ID } = require("./src/db");
    startPoolMetricsLogging(pool);
    const { markBootPhaseComplete } = require("./src/observability/processLifecycle");
    markBootPhaseComplete();
    logInfo("RUNTIME_BOOT_COMPLETE", { poolInstanceId: POOL_INSTANCE_ID });

    // Start auto-apply recovery loop (fire-and-forget, P0 fix)
    recoveryLoop().catch(err => {
      logError("RECOVERY_BOOT_ERROR", err);
    });
  });
}

module.exports = app;
