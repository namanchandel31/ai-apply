/**
 * Express HTTP application (API layer only).
 * No BullMQ workers, no static frontend — enqueue + respond only.
 */
const express = require("express");
const cors = require("cors");
const pinoHttp = require("pino-http");
const config = require("../config");
const { logger, logError } = require("../utils/logger");
const tracingMiddleware = require("../middlewares/tracing");

function createApp() {
  const app = express();

  app.use(tracingMiddleware);

  app.use(
    pinoHttp({
      logger,
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
    })
  );

  app.use(cors(config.cors.buildCorsMiddlewareOptions()));

  // Razorpay webhook needs the raw body for signature verification, so it must
  // be mounted BEFORE the global JSON body parser.
  const { razorpayWebhookController } = require("../controllers/billingWebhookController");
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    razorpayWebhookController
  );

  app.use(express.json());

  const {
    uploadRateLimit,
    readRateLimit,
    aiRateLimit,
    applyRateLimit,
    autoApplyRateLimit,
  } = require("../middlewares/rateLimitMiddleware");

  const resumeRoutes = require("../routes/resumeRoutes");
  const jdRoutes = require("../routes/jdRoutes");
  const applyRoutes = require("../routes/applyRoutes");
  const credentialRoutes = require("../routes/credentialRoutes");
  const sendRoutes = require("../routes/sendRoutes");
  const autoApplyRoutes = require("../routes/autoApplyRoutes");
  const applicationRoutes = require("../routes/applicationRoutes");
  const realtimeRoutes = require("../routes/realtimeRoutes");
  const orchestrationRoutes = require("../routes/orchestrationRoutes");
  const userRoutes = require("../routes/userRoutes");
  const aiRoutes = require("../routes/aiRoutes");
  const billingRoutes = require("../routes/billingRoutes");

  if (!config.server.isProduction) {
    const { swaggerUi, swaggerSpec } = require("../docs/swagger");
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      swaggerOptions: { persistAuthorization: true },
    }));
    app.get("/openapi.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });
  }

  app.use("/api", uploadRateLimit, resumeRoutes);
  app.use("/api", uploadRateLimit, jdRoutes);
  app.use("/api/apply", applyRateLimit, applyRoutes);
  app.use("/api", applyRateLimit, sendRoutes);
  app.use("/api", credentialRoutes);
  app.use("/api", autoApplyRateLimit, autoApplyRoutes);
  app.use("/api", readRateLimit, applicationRoutes);
  app.use("/api", realtimeRoutes);
  app.use("/api", orchestrationRoutes);
  app.use("/api", readRateLimit, userRoutes);
  app.use("/api", aiRateLimit, aiRoutes);
  app.use("/api", billingRoutes);

  const adminBillingRoutes = require("../routes/adminBillingRoutes");
  app.use("/api", adminBillingRoutes);

  // Admin-only (gated by users.is_admin via adminGuard inside the router).
  const modelCertificationRoutes = require("../routes/modelCertificationRoutes");
  app.use("/api", modelCertificationRoutes);

  const extensionRoutes = require("../routes/extensionRoutes");
  app.use("/api", readRateLimit, extensionRoutes);

  app.get("/internal/queue-health", async (req, res) => {
    const apiKey = req.headers["x-internal-api-key"];
    if (apiKey !== config.auth.internalApiKey) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
      const { getQueueHealth } = require("../services/queueHealthService");
      const health = await getQueueHealth();
      return res.json({ success: true, health });
    } catch (err) {
      logError("QUEUE_HEALTH_ERROR", err, { component: "api" });
      return res.status(500).json({ success: false, message: "Failed to fetch queue health" });
    }
  });

  let cachedProviderHealth = null;
  let lastProviderHealthFetch = 0;

  app.get("/internal/provider-health", (req, res) => {
    const apiKey = req.headers["x-internal-api-key"];
    if (apiKey !== config.auth.internalApiKey) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const now = Date.now();
    if (cachedProviderHealth && now - lastProviderHealthFetch < 2000) {
      return res.json({ success: true, version: 1, cached: true, health: cachedProviderHealth });
    }
    try {
      const llmProtection = require("../services/llmProtection");
      cachedProviderHealth = llmProtection.getMetrics();
      lastProviderHealthFetch = now;
      return res.json({ success: true, version: 1, cached: false, health: cachedProviderHealth });
    } catch (err) {
      logError("PROVIDER_HEALTH_ERROR", err, { component: "api" });
      return res.status(500).json({ success: false, message: "Failed to fetch provider health" });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    const { buildLogContext } = require("../utils/buildLogContext");
    const { sendError } = require("../utils/httpErrorResponse");
    logError(
      "UNHANDLED_REQUEST_ERROR",
      err,
      buildLogContext({
        component: "api",
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

  return app;
}

module.exports = { createApp };
