require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const { testConnection } = require("./src/db");
const { logger, logInfo, logError } = require("./src/utils/logger");
const tracingMiddleware = require("./src/middlewares/tracing");
const { recoverStaleProcessing } = require("./src/models/applicationModel");

// Fail-fast checks for required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing from environment variables");
}

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

const { applyRateLimit, uploadRateLimit, readRateLimit } = require("./src/middlewares/rateLimitMiddleware");

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const authRoutes       = require("./src/routes/authRoutes");
const resumeRoutes     = require("./src/routes/resumeRoutes");
const jdRoutes         = require("./src/routes/jdRoutes");
const applyRoutes      = require("./src/routes/applyRoutes");
const credentialRoutes = require("./src/routes/credentialRoutes");
const sendRoutes       = require("./src/routes/sendRoutes");

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

// ---------------------------------------------------------------------------
// Health check (no auth, no rate limit, suppressed from logs above)
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Global error handler — catch-all for unhandled errors thrown by middleware
// ---------------------------------------------------------------------------

app.use((err, req, res, _next) => {
  logError("unhandled_error", err, { reqId: req.requestId || "NO_REQ_ID" });
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Stale processing recovery scheduler
//
// Runs every 5 minutes. Finds jobs stuck in 'processing' > 10 min and resets
// them to 'pending' (or 'abandoned' if retry_count >= MAX_RETRIES).
//
// Multi-instance safe: PostgreSQL row-level atomicity ensures each row is
// updated by exactly one instance even under concurrent recovery runs.
// The scheduler can be migrated to pg-cron / Railway Cron in the future
// by moving recoverStaleProcessing() to a worker entrypoint — no code changes
// to the function itself are required.
// ---------------------------------------------------------------------------

const STALE_RECOVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const runStaleRecovery = async () => {
  try {
    const recovered = await recoverStaleProcessing();
    if (recovered.length > 0) {
      logInfo("stale_recovery_complete", { count: recovered.length, recovered });
    }
  } catch (err) {
    logError("stale_recovery_error", err, {});
  }
};

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, async () => {
    logInfo("server_start", { port: PORT });
    await testConnection();

    // Run stale recovery once at startup to clear any jobs orphaned by a crash,
    // then schedule it on the recurring interval.
    await runStaleRecovery();
    setInterval(runStaleRecovery, STALE_RECOVERY_INTERVAL_MS);
  });
}

module.exports = app;
