const IORedis = require("ioredis");
const config = require("../config");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { logInfo, logError } = require("../utils/logger");
const { broadcastToUser } = require("./sseConnectionRegistry");
const { formatSseEvent } = require("./sseFormat");
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
  subscriber.on("error", (err) => logError("REALTIME_REDIS_SUBSCRIBER_ERROR", err));

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

      const sent = broadcastToUser(payload.userId, (res) => {
        res.write(formatSseEvent("application.updated", payload));
      });

      if (sent > 0) {
        const { metrics } = require("../observability/orchestrationMetrics");
        metrics.increment("orchestration.sse.event_sent", { via: "redis" }, sent);
      }
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
