const { realtimeBus } = require("../events/realtimeBus");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { logInfo } = require("../utils/logger");
const { logRealtimeLifecycle, envelopeFromPayload } = require("./realtimeLifecycleLog");
const { metrics } = require("../observability/orchestrationMetrics");
const { broadcastToUser } = require("./sseConnectionRegistry");
const { writeSseEvent } = require("./sseFormat");
const { wasAlreadyEmitted } = require("./publishDedupeRegistry");

const config = require("../config");
const HEARTBEAT_MS = config.realtime.SSE_HEARTBEAT_MS;

let gatewayStarted = false;
let busHandler = null;

function broadcastApplicationUpdated(payload) {
  if (
    payload?.applicationId != null &&
    wasAlreadyEmitted(
      payload.applicationId,
      Number(payload.version) || 0,
      Number(payload.orchestrationEpoch) || 0
    )
  ) {
    return;
  }

  const eventId = payload.eventId;
  const sent = broadcastToUser(payload.userId, (res) => {
    const result = writeSseEvent(
      res,
      payload.userId,
      "application.updated",
      payload,
      eventId
    );
    return result.ok;
  });

  if (sent > 0) {
    metrics.increment("orchestration.sse.event_sent", { via: "local" }, sent);
    logRealtimeLifecycle("SSE_EVENT_SENT", envelopeFromPayload(payload, { sent }));
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
