const { logWarn } = require("./logger");

const DEFAULT_WINDOW_MS = Number(process.env.LOG_DEDUPE_WINDOW_MS) || 60_000;
const DEFAULT_BUCKET_TTL_MS = Number(process.env.LOG_DEDUPE_BUCKET_TTL_MS) || 120_000;
const DEFAULT_MAX_BUCKETS = Number(process.env.LOG_DEDUPE_MAX_BUCKETS) || 500;
const PRUNE_INTERVAL_MS = 30_000;

/** @type {Map<string, { event: string, level: string, count: number, firstAt: number, lastAt: number, lastMeta: object }>} */
const buckets = new Map();
/** @type {string[]} */
const lruOrder = [];

let evictedBucketCount = 0;
let pruneTimer = null;

function bucketKey(level, event, key) {
  return `${level}:${event}:${key}`;
}

function touchLru(k) {
  const idx = lruOrder.indexOf(k);
  if (idx >= 0) lruOrder.splice(idx, 1);
  lruOrder.push(k);
}

function evictOldest() {
  const oldest = lruOrder.shift();
  if (!oldest) return;
  buckets.delete(oldest);
  evictedBucketCount += 1;
}

function ensureCapacity() {
  while (buckets.size >= DEFAULT_MAX_BUCKETS && lruOrder.length > 0) {
    evictOldest();
  }
}

function pruneExpired(now = Date.now()) {
  for (const [k, b] of buckets) {
    if (now - b.lastAt > DEFAULT_BUCKET_TTL_MS) {
      buckets.delete(k);
      const idx = lruOrder.indexOf(k);
      if (idx >= 0) lruOrder.splice(idx, 1);
      evictedBucketCount += 1;
    }
  }
}

function getDedupeStats() {
  let bytes = 0;
  for (const [k, b] of buckets) {
    bytes += k.length * 2 + 80 + JSON.stringify(b.lastMeta || {}).length;
  }
  return {
    activeBucketCount: buckets.size,
    evictedBucketCount,
    dedupeMemoryUsageEstimate: bytes,
    maxBuckets: DEFAULT_MAX_BUCKETS,
    windowMs: DEFAULT_WINDOW_MS,
    bucketTtlMs: DEFAULT_BUCKET_TTL_MS,
  };
}

/**
 * @param {'warn'|'info'} level
 * @param {string} event
 * @param {string} key
 * @param {object} [metadata]
 */
function record(level, event, key, metadata = {}) {
  const now = Date.now();
  const k = bucketKey(level, event, key);
  const existing = buckets.get(k);
  if (existing) {
    existing.count += 1;
    existing.lastAt = now;
    existing.lastMeta = metadata;
    touchLru(k);
    return;
  }
  ensureCapacity();
  buckets.set(k, {
    level,
    event,
    count: 1,
    firstAt: now,
    lastAt: now,
    lastMeta: metadata,
  });
  touchLru(k);
}

function flush(now = Date.now()) {
  pruneExpired(now);
  for (const [k, b] of buckets) {
    if (now - b.firstAt < DEFAULT_WINDOW_MS && b.count < 2) continue;

    const durationMs = Math.max(1, b.lastAt - b.firstAt);
    const payload = {
      ...b.lastMeta,
      repeatedCount: b.count,
      durationMs,
      component: b.lastMeta.component || "orchestration",
    };

    if (b.count > 1) {
      payload.message = `${b.event} repeated ${b.count} times in ${Math.round(durationMs / 1000)}s`;
    }

    if (b.level === "warn") {
      logWarn(b.event, payload);
    }

    buckets.delete(k);
    const idx = lruOrder.indexOf(k);
    if (idx >= 0) lruOrder.splice(idx, 1);
  }
}

function startPruneLoop() {
  if (pruneTimer || process.env.NODE_ENV === "test") return;
  pruneTimer = setInterval(() => {
    pruneExpired();
    flush();
  }, PRUNE_INTERVAL_MS);
  if (pruneTimer.unref) pruneTimer.unref();
}

function stopPruneLoop() {
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
}

startPruneLoop();

const orchestrationDedupe = {
  record,
  flush,
  prune: pruneExpired,
  getStats: getDedupeStats,
  stop: stopPruneLoop,
};

function resetForTests() {
  buckets.clear();
  lruOrder.length = 0;
  evictedBucketCount = 0;
}

module.exports = {
  createDedupeLogger: () => orchestrationDedupe,
  orchestrationDedupe,
  resetForTests,
};
