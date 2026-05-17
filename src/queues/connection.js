const IORedis = require("ioredis");
const { logError } = require("../utils/logger");

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is missing.");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on("error", (err) => {
  logError("redis_connection_error", err);
});

module.exports = { connection };
