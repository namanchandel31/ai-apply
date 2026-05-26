const { str } = require("./env");

const REDIS_CHANNEL = "ai-apply:realtime";

/**
 * BullMQ + realtime Redis URL.
 * Prefer REDIS_URL; Upstash provides this as a rediss:// URL in the dashboard.
 */
function resolveRedisUrl() {
  return (
    str("REDIS_URL", null) ||
    str("UPSTASH_REDIS_URL", null) ||
    null
  );
}

module.exports = {
  redisUrl: resolveRedisUrl(),
  upstashToken: str("UPSTASH_REDIS_TOKEN", null),
  realtimeChannel: REDIS_CHANNEL,
  realtimeRedisEnabled(redisUrl = resolveRedisUrl()) {
    return Boolean(redisUrl);
  },
  resolveRedisUrl,
};
