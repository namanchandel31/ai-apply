const IORedis = require("ioredis");
const config = require("../config");
const { attachRedisErrorHandler } = require("../observability/networkError");
if (!config.redis.redisUrl) {
  throw new Error("REDIS_URL environment variable is required");
}

let shuttingDown = false;

/**
 * BullMQ connection options — pass to Queue/Worker constructors.
 * Each BullMQ component creates its own ioredis client (required for blocking Workers).
 */
function getBullmqConnectionOptions() {
  return {
    url: config.redis.redisUrl,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      if (shuttingDown) return null;
      return Math.min(Math.max(times * 200, 1000), 20000);
    },
  };
}

function markBullmqShuttingDown() {
  shuttingDown = true;
}

function isBullmqShuttingDown() {
  return shuttingDown;
}

function createEphemeralRedisClient(role) {
  const client = new IORedis(config.redis.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy(times) {
      if (shuttingDown || times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  attachRedisErrorHandler(client, "bullmq_redis", { role });

  return client;
}

async function pingRedis() {
  const client = createEphemeralRedisClient("bullmq_health_ping");
  try {
    await client.connect();
    const pong = await client.ping();
    return pong === "PONG";
  } finally {
    if (client.status !== "end") {
      await client.quit();
    }
  }
}

async function getRedisHealthStatus() {
  const client = createEphemeralRedisClient("bullmq_health_status");
  try {
    await client.connect();
    return { connected: client.status === "ready", status: client.status };
  } catch {
    return { connected: false, status: client.status };
  } finally {
    if (client.status !== "end") {
      await client.quit();
    }
  }
}

async function closeBullmqQueues() {
  markBullmqShuttingDown();
  const closes = [];
  try {
    const { processApplicationQueue } = require("./processApplicationQueue");
    closes.push(processApplicationQueue.close());
  } catch (_) {
    /* queue module may not be loaded */
  }
  try {
    const { sendApplicationQueue } = require("./sendApplicationQueue");
    closes.push(sendApplicationQueue.close());
  } catch (_) {
    /* queue module may not be loaded */
  }
  await Promise.allSettled(closes);
}

module.exports = {
  getBullmqConnectionOptions,
  markBullmqShuttingDown,
  isBullmqShuttingDown,
  pingRedis,
  getRedisHealthStatus,
  closeBullmqQueues,
};
