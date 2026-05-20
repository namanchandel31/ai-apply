type Bucket = {
  event: string;
  level: string;
  count: number;
  firstAt: number;
  lastAt: number;
  lastMeta: Record<string, unknown>;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_BUCKET_TTL_MS = 120_000;
const DEFAULT_MAX_BUCKETS = 500;

const buckets = new Map<string, Bucket>();
const lruOrder: string[] = [];
let evictedBucketCount = 0;

function bucketKey(level: string, event: string, key: string) {
  return `${level}:${event}:${key}`;
}

function touchLru(k: string) {
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

export function getDedupeStats() {
  let bytes = 0;
  for (const [k, b] of buckets) {
    bytes += k.length * 2 + 80 + JSON.stringify(b.lastMeta || {}).length;
  }
  return {
    activeBucketCount: buckets.size,
    evictedBucketCount,
    dedupeMemoryUsageEstimate: bytes,
  };
}

export function recordDedupe(
  level: "warn" | "info",
  event: string,
  key: string,
  metadata: Record<string, unknown> = {}
) {
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

export type DedupeFlushHandler = (
  event: string,
  meta: Record<string, unknown>
) => void;

export function flushDedupe(
  onWarn: DedupeFlushHandler,
  now = Date.now()
) {
  for (const [k, b] of buckets) {
    if (now - b.lastAt > DEFAULT_BUCKET_TTL_MS) {
      buckets.delete(k);
      const idx = lruOrder.indexOf(k);
      if (idx >= 0) lruOrder.splice(idx, 1);
      continue;
    }
    if (now - b.firstAt < DEFAULT_WINDOW_MS && b.count < 2) continue;

    const durationMs = Math.max(1, b.lastAt - b.firstAt);
    onWarn(b.event, {
      ...b.lastMeta,
      repeatedCount: b.count,
      durationMs,
      message: `${b.event} repeated ${b.count} times in ${Math.round(durationMs / 1000)}s`,
    });
    buckets.delete(k);
    const idx = lruOrder.indexOf(k);
    if (idx >= 0) lruOrder.splice(idx, 1);
  }
}

export function resetDedupeForTests() {
  buckets.clear();
  lruOrder.length = 0;
  evictedBucketCount = 0;
}
