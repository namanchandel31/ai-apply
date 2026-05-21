/**
 * SSE replay buffer — eventId is transport sequencing only, not business ordering.
 * Business truth remains orchestration_version on each payload.
 */
const IORedis = require("ioredis");
const config = require("../config");
const { logDebug, logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { attachRedisErrorHandler } = require("../observability/networkError");

const RETENTION_MS = 30 * 60 * 1000;
const MAXLEN_APPROX = 10_000;
const TRIM_INTERVAL_MS = 5 * 60 * 1000;

let redisClient = null;
let sequence = 0;
/** @type {Map<string, Array<{ eventId: string, payload: object, ts: number }>>} */
const memoryBuffers = new Map();

function redisEnabled() {
  return config.redis.realtimeRedisEnabled();
}

function getRedis() {
  if (!redisEnabled()) return null;
  if (!redisClient) {
    redisClient = new IORedis(config.redis.redisUrl, { maxRetriesPerRequest: null });
    attachRedisErrorHandler(redisClient, "sse_replay_buffer", { role: "replay" });
  }
  return redisClient;
}

function streamKey(userId) {
  return `realtime:replay:${userId}`;
}

function nextEventId() {
  sequence += 1;
  return `${Date.now()}-${sequence}`;
}

const { wasAlreadyEmitted } = require("./publishDedupeRegistry");

async function appendReplayEvent(userId, payload, options = {}) {
  if (
    payload?.applicationId != null &&
    wasAlreadyEmitted(
      payload.applicationId,
      Number(payload.version) || 0,
      Number(payload.orchestrationEpoch) || 0
    )
  ) {
    return { eventId: payload.eventId, payload, skipped: true };
  }

  const eventId = payload.eventId || nextEventId();
  const entry = { eventId, payload: { ...payload, eventId }, ts: Date.now() };

  const redis = getRedis();
  if (redis) {
    try {
      await redis.xadd(
        streamKey(userId),
        "MAXLEN",
        "~",
        MAXLEN_APPROX,
        eventId,
        "data",
        JSON.stringify(entry.payload)
      );
    } catch (err) {
      logDebug("REPLAY_BUFFER_APPEND_FAILED", { userId, message: err?.message }, "realtime");
    }
    return { eventId, payload: entry.payload };
  }

  if (!memoryBuffers.has(userId)) memoryBuffers.set(userId, []);
  const buf = memoryBuffers.get(userId);
  buf.push(entry);
  while (buf.length > MAXLEN_APPROX) buf.shift();
  const cutoff = Date.now() - RETENTION_MS;
  while (buf.length && buf[0].ts < cutoff) buf.shift();

  return { eventId, payload: entry.payload };
}

function parseStreamEntries(entries) {
  const out = [];
  for (const [streamId, fields] of entries) {
    const dataIdx = fields.indexOf("data");
    if (dataIdx < 0) continue;
    try {
      const payload = JSON.parse(fields[dataIdx + 1]);
      out.push({ eventId: streamId, payload });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

async function readReplayAfter(userId, lastEventId) {
  const redis = getRedis();
  if (redis) {
    try {
      const entries = await redis.xrange(streamKey(userId), `(${lastEventId}`, "+");
      if (!entries?.length) {
        const exists = await redis.exists(streamKey(userId));
        if (exists && lastEventId) {
          metrics.increment("orchestration.replay.miss_count");
          return { events: [], status: "miss" };
        }
        if (lastEventId) {
          metrics.increment("orchestration.replay.tier3_replay_expired");
          return { events: [], status: "expired" };
        }
        return { events: [], status: "ok" };
      }
      return { events: parseStreamEntries(entries), status: "ok" };
    } catch (err) {
      logDebug("REPLAY_BUFFER_READ_FAILED", { userId, message: err?.message }, "realtime");
      return { events: [], status: "unavailable" };
    }
  }

  const buf = memoryBuffers.get(userId) ?? [];
  const idx = buf.findIndex((e) => e.eventId === lastEventId);
  const slice = idx >= 0 ? buf.slice(idx + 1) : buf;
  const cutoff = Date.now() - RETENTION_MS;
  const events = slice
    .filter((e) => e.ts >= cutoff)
    .map((e) => ({ eventId: e.eventId, payload: e.payload }));

  if (lastEventId && events.length === 0 && buf.length > 0) {
    metrics.increment("orchestration.replay.miss_count");
    return { events: [], status: "miss" };
  }
  return { events, status: "ok" };
}

async function trimExpiredStreams() {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys("realtime:replay:*");
    const minId = `${Date.now() - RETENTION_MS}-0`;
    for (const key of keys) {
      await redis.xtrim(key, "MINID", minId);
    }
    logInfo("REPLAY_BUFFER_TRIM", { keys: keys.length });
  } catch {
    /* ignore trim errors */
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    void trimExpiredStreams();
  }, TRIM_INTERVAL_MS).unref?.();
}

function resetReplayBufferForTests() {
  memoryBuffers.clear();
  sequence = 0;
}

module.exports = {
  appendReplayEvent,
  readReplayAfter,
  nextEventId,
  resetReplayBufferForTests,
  RETENTION_MS,
};
