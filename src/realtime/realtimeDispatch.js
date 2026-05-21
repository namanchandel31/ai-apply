const IORedis = require("ioredis");
const config = require("../config");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { realtimeBus } = require("../events/realtimeBus");
const { logError } = require("../utils/logger");
const { logRealtimeLifecycle, envelopeFromPayload } = require("./realtimeLifecycleLog");
const { attachRedisErrorHandler } = require("../observability/networkError");

let redisPublisher = null;

function redisRealtimeEnabled() {
  return config.redis.realtimeRedisEnabled();
}

function getPublisher() {
  if (!redisRealtimeEnabled()) return null;
  if (!redisPublisher) {
    redisPublisher = new IORedis(config.redis.redisUrl, { maxRetriesPerRequest: null });
    attachRedisErrorHandler(redisPublisher, "redis_pubsub_publisher", {
      hypothesisId: "C",
      role: "publisher",
    });
  }
  return redisPublisher;
}

async function publishToRedis(payload) {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(config.redis.realtimeChannel, JSON.stringify(payload));
    logRealtimeLifecycle("REDIS_PUBLISH_OK", envelopeFromPayload(payload));
  } catch (err) {
    logError("REALTIME_REDIS_PUBLISH_FAILED", err, {
      applicationId: payload.applicationId,
    });
    logRealtimeLifecycle("REDIS_PUBLISH_FAILED", envelopeFromPayload(payload, {
      error_message: err?.message,
    }));
  }
}

function fanOutRealtimePayload(payload) {
  if (redisRealtimeEnabled()) {
    logRealtimeLifecycle("REDIS_FANOUT_SCHEDULED", envelopeFromPayload(payload));
    void publishToRedis(payload);
    return;
  }
  realtimeBus.emit(EVENT_APPLICATION_UPDATED, payload);
  logRealtimeLifecycle("REALTIME_LOCAL_FANOUT", envelopeFromPayload(payload));
}

function ensureRealtimePublisher() {
  getPublisher();
}

module.exports = {
  REDIS_CHANNEL: config.redis.realtimeChannel,
  redisRealtimeEnabled,
  fanOutRealtimePayload,
  ensureRealtimePublisher,
};
