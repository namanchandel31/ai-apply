const IORedis = require("ioredis");
const config = require("../config");

if (!config.redis.redisUrl) {
  throw new Error("REDIS_URL environment variable is required");
}

const connection = new IORedis(config.redis.redisUrl, {
  maxRetriesPerRequest: null,
});

module.exports = { connection };
