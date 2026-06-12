const { str } = require("./env");

const REDIS_CHANNEL = "ai-apply:realtime";

/**
 * Docker Desktop on Windows often maps Redis to IPv4 (127.0.0.1) only.
 * Node resolves `localhost` to ::1 first, which yields immediate ECONNRESET.
 */
function normalizeRedisUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return parsed.toString();
    }
  } catch {
    /* keep original string */
  }
  return url;
}

/**
 * BullMQ + realtime Redis URL.
 * Prefer REDIS_URL; Upstash provides this as a rediss:// URL in the dashboard.
 */
function resolveRedisUrl() {
  const raw =
    str("REDIS_URL", null) ||
    str("UPSTASH_REDIS_URL", null) ||
    null;
  return normalizeRedisUrl(raw);
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
