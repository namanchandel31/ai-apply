const { realtimeBus } = require("../events/realtimeBus");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { broadcastToUser } = require("./sseConnectionRegistry");

const HEARTBEAT_MS = parseInt(process.env.SSE_HEARTBEAT_MS || "25000", 10);

let gatewayStarted = false;
let busHandler = null;

const { formatSseEvent } = require("./sseFormat");

function broadcastApplicationUpdated(payload) {
  const sent = broadcastToUser(payload.userId, (res) => {
    res.write(formatSseEvent("application.updated", payload));
  });

  if (sent > 0) {
    metrics.increment("orchestration.sse.event_sent", { via: "local" }, sent);
  }
}

function startSseGateway() {
  if (gatewayStarted) return;
  gatewayStarted = true;

  const { redisRealtimeEnabled, startRedisRealtimeBridge } = require("./redisRealtimeBridge");

  if (redisRealtimeEnabled()) {
    startRedisRealtimeBridge();
  } else {
    busHandler = (payload) => {
      if (!payload?.userId) return;
      broadcastApplicationUpdated(payload);
    };
    realtimeBus.on(EVENT_APPLICATION_UPDATED, busHandler);
  }

  logInfo("SSE_GATEWAY_STARTED", {
    heartbeatMs: HEARTBEAT_MS,
    transport: redisRealtimeEnabled() ? "redis" : "local",
  });
}

function stopSseGateway() {
  if (!gatewayStarted) return;
  if (busHandler) {
    realtimeBus.off(EVENT_APPLICATION_UPDATED, busHandler);
    busHandler = null;
  }
  gatewayStarted = false;
}

module.exports = {
  startSseGateway,
  stopSseGateway,
  HEARTBEAT_MS,
  broadcastApplicationUpdated,
};
