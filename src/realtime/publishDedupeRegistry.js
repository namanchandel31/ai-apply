/**
 * Canonical publish dedupe: one emission per (applicationId, version, orchestrationEpoch).
 * eventId is recorded for diagnostics only — not part of the dedupe key.
 */
const { logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 10_000;

/** @type {Map<string, { recordedAt: number, eventId?: string, publishSource?: string }>} */
const emitted = new Map();

function publishKey(applicationId, version, epoch) {
  return `${applicationId}:${version}:${epoch}`;
}

function evictExpired(now = Date.now()) {
  for (const [key, entry] of emitted) {
    if (now - entry.recordedAt > TTL_MS) emitted.delete(key);
  }
  if (emitted.size <= MAX_ENTRIES) return;
  const sorted = [...emitted.entries()].sort((a, b) => a[1].recordedAt - b[1].recordedAt);
  const remove = sorted.length - MAX_ENTRIES;
  for (let i = 0; i < remove; i += 1) {
    emitted.delete(sorted[i][0]);
  }
}

/**
 * @param {{ applicationId: string, version: number, orchestrationEpoch: number, publishSource?: string, blockedAtLayer?: string }} meta
 */
function shouldEmitPublish(meta) {
  const key = publishKey(meta.applicationId, meta.version, meta.orchestrationEpoch);
  evictExpired();
  const existing = emitted.get(key);
  if (existing) {
    metrics.increment("orchestration.realtime.duplicate_blocked");
    logInfo("DUPLICATE_EVENT_BLOCKED", {
      applicationId: meta.applicationId,
      version: meta.version,
      orchestrationEpoch: meta.orchestrationEpoch,
      eventId: existing.eventId,
      publishSource: meta.publishSource,
      priorPublishSource: existing.publishSource,
      blockedAtLayer: meta.blockedAtLayer || "dedupe_registry",
      component: "realtime",
    });
    return { allow: false, key, blockedReason: "triple_already_emitted" };
  }
  return { allow: true, key };
}

function recordEmitted(key, meta = {}) {
  emitted.set(key, {
    recordedAt: Date.now(),
    eventId: meta.eventId,
    publishSource: meta.publishSource,
  });
  evictExpired();
}

function wasAlreadyEmitted(applicationId, version, epoch) {
  const key = publishKey(applicationId, version, epoch);
  evictExpired();
  return emitted.has(key);
}

function resetPublishDedupeForTests() {
  emitted.clear();
}

module.exports = {
  publishKey,
  shouldEmitPublish,
  recordEmitted,
  wasAlreadyEmitted,
  resetPublishDedupeForTests,
};
