const IORedis = require("ioredis");
const config = require("../config");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { realtimeBus } = require("../events/realtimeBus");
const { logError } = require("../utils/logger");

let redisPublisher = null;

function redisRealtimeEnabled() {
  return config.redis.realtimeRedisEnabled();
}

function getPublisher() {
  if (!redisRealtimeEnabled()) return null;
  if (!redisPublisher) {
    redisPublisher = new IORedis(config.redis.redisUrl, { maxRetriesPerRequest: null });
    redisPublisher.on("error", (err) => logError("REALTIME_REDIS_PUBLISHER_ERROR", err));
  }
  return redisPublisher;
}

async function publishToRedis(payload) {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(config.redis.realtimeChannel, JSON.stringify(payload));
  } catch (err) {
    logError("REALTIME_REDIS_PUBLISH_FAILED", err, {
      applicationId: payload.applicationId,
    });
  }
}

function fanOutRealtimePayload(payload) {
  if (redisRealtimeEnabled()) {
    void publishToRedis(payload);
    return;
  }
  realtimeBus.emit(EVENT_APPLICATION_UPDATED, payload);
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
