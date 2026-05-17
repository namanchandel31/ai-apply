require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const { testConnection } = require("./src/db");
const { logger, logInfo, logError } = require("./src/utils/logger");
const tracingMiddleware = require("./src/middlewares/tracing");
const { recoverStaleProcessing } = require("./src/models/applicationModel");

// Fail-fast checks for required environment variables
["JWT_SECRET", "REDIS_URL", "INTERNAL_API_KEY"].forEach(key => {
  if (!process.env[key]) {
    throw new Error(`${key} missing from environment variables`);
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

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
  // Suppress health check noise
  autoLogging: { ignore: (req) => req.url === "/health" },
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
const userRoutes       = require("./src/routes/userRoutes");

// ---------------------------------------------------------------------------
// Swagger UI — development only
// Playground: http://localhost:5000/docs
// OpenAPI spec: http://localhost:5000/openapi.json
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== "production") {
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
app.use("/api", readRateLimit, userRoutes);

// Internal Queue Health
app.get("/internal/queue-health", async (req, res) => {
  const apiKey = req.headers["x-internal-api-key"];
  if (apiKey !== process.env.INTERNAL_API_KEY) {
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

app.use((err, req, res, _next) => {
  logError("unhandled_error", err, { reqId: req.requestId || "NO_REQ_ID" });
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Worker & Recovery
// ---------------------------------------------------------------------------

// Inline worker — dev ONLY, hard-guarded
if (process.env.WORKER_MODE === "inline" && process.env.NODE_ENV !== "production") {
  require("./src/workers/sendApplication.worker");
  logInfo("inline_worker_started", { queue: "send-application" });
}

const { recoveryLoop } = require("./src/jobs/recovery.job");

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, async () => {
    logInfo("server_start", { port: PORT });
    await testConnection();

    // Start auto-apply recovery loop (fire-and-forget, P0 fix)
    recoveryLoop().catch(err => {
      logError("RECOVERY_BOOT_ERROR", err);
    });
  });
}

module.exports = app;
