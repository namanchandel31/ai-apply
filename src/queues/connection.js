const IORedis = require("ioredis");
const config = require("../config");
const { attachRedisErrorHandler } = require("../observability/networkError");

if (!config.redis.redisUrl) {
  throw new Error("REDIS_URL environment variable is required");
}

const connection = new IORedis(config.redis.redisUrl, {
  maxRetriesPerRequest: null,
});

attachRedisErrorHandler(connection, "bullmq_redis", {
  hypothesisId: "C",
  role: "bullmq_shared_connection",
});

module.exports = { connection };
