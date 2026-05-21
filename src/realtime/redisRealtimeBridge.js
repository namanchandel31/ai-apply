const IORedis = require("ioredis");
const config = require("../config");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { logInfo, logError } = require("../utils/logger");
const { logRealtimeLifecycle, envelopeFromPayload } = require("./realtimeLifecycleLog");
const { attachRedisErrorHandler } = require("../observability/networkError");
const { broadcastToUser } = require("./sseConnectionRegistry");
const { writeSseEvent } = require("./sseFormat");
const { wasAlreadyEmitted } = require("./publishDedupeRegistry");
const {
  redisRealtimeEnabled,
  ensureRealtimePublisher,
  fanOutRealtimePayload,
} = require("./realtimeDispatch");

let subscriber = null;
let bridgeStarted = false;

function startRedisRealtimeBridge() {
  if (!redisRealtimeEnabled() || bridgeStarted) return;
  bridgeStarted = true;

  subscriber = new IORedis(config.redis.redisUrl, { maxRetriesPerRequest: null });
  attachRedisErrorHandler(subscriber, "redis_pubsub_subscriber", {
    hypothesisId: "C",
    role: "subscriber",
  });

  subscriber.subscribe(config.redis.realtimeChannel, (err) => {
    if (err) {
      logError("REALTIME_REDIS_SUBSCRIBE_FAILED", err);
      return;
    }
    logInfo("REALTIME_REDIS_BRIDGE_STARTED", { channel: config.redis.realtimeChannel });
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const payload = JSON.parse(message);
      if (payload?.type !== EVENT_APPLICATION_UPDATED || !payload.userId) return;

      if (
        payload.applicationId != null &&
        wasAlreadyEmitted(
          payload.applicationId,
          Number(payload.version) || 0,
          Number(payload.orchestrationEpoch) || 0
        )
      ) {
        return;
      }

      const sent = broadcastToUser(payload.userId, (res) => {
        const result = writeSseEvent(
          res,
          payload.userId,
          "application.updated",
          payload,
          payload.eventId
        );
        return result.ok;
      });

      if (sent > 0) {
        const { metrics } = require("../observability/orchestrationMetrics");
        metrics.increment("orchestration.sse.event_sent", { via: "redis" }, sent);
        logRealtimeLifecycle("SSE_EVENT_SENT", envelopeFromPayload(payload, { sent, via: "redis" }));
      }
      logRealtimeLifecycle("REDIS_MESSAGE_RECEIVED", envelopeFromPayload(payload));
    } catch (err) {
      logError("REALTIME_REDIS_MESSAGE_PARSE_FAILED", err);
    }
  });
}

module.exports = {
  redisRealtimeEnabled,
  startRedisRealtimeBridge,
  ensureRealtimePublisher,
  fanOutRealtimePayload,
  CHANNEL: config.redis.realtimeChannel,
};
