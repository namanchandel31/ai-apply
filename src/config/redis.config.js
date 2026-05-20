const { str } = require("./env");

const REDIS_CHANNEL = "ai-apply:realtime";

module.exports = {
  redisUrl: str("REDIS_URL", null),
  realtimeChannel: REDIS_CHANNEL,
  realtimeRedisEnabled(redisUrl = str("REDIS_URL", null)) {
    return Boolean(redisUrl);
  },
};
