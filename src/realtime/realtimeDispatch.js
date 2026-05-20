const IORedis = require("ioredis");
const { EVENT_APPLICATION_UPDATED } = require("../contracts/applicationEvents");
const { realtimeBus } = require("../events/realtimeBus");
const { logError } = require("../utils/logger");

const REDIS_CHANNEL = process.env.REALTIME_REDIS_CHANNEL || "ai-apply:realtime";

let redisPublisher = null;

function redisRealtimeEnabled() {
  return Boolean(process.env.REDIS_URL && process.env.REALTIME_REDIS !== "0");
}

function getPublisher() {
  if (!redisRealtimeEnabled()) return null;
  if (!redisPublisher) {
    redisPublisher = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    redisPublisher.on("error", (err) => logError("REALTIME_REDIS_PUBLISHER_ERROR", err));
  }
  return redisPublisher;
}

async function publishToRedis(payload) {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(REDIS_CHANNEL, JSON.stringify(payload));
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
  REDIS_CHANNEL,
  redisRealtimeEnabled,
  fanOutRealtimePayload,
  ensureRealtimePublisher,
};
