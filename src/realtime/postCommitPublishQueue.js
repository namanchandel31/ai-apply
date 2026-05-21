/**
 * In-memory post-commit publish queue (v1).
 *
 * DURABILITY LIMITS (see docs/architecture/realtime-recovery-contract.md):
 * - NOT a transactional outbox; committed-but-unflushed entries may be lost on process crash.
 * - Best-effort orphan sweep only within the same process.
 * - Future: application_outbox table or Redis Stream relay.
 */

const { metrics } = require("../observability/orchestrationMetrics");
const { logRealtimeLifecycle } = require("./realtimeLifecycleLog");
const { enqueuePublishBatch } = require("./publishBatchProcessor");

const MAX_PENDING = 500;
const UNCOMMITTED_TTL_MS = 60_000;
const COMMITTED_FLUSH_TTL_MS = 30_000;
const MAX_FLUSH_ATTEMPTS = 3;
const SWEEP_INTERVAL_MS = 15_000;

/** @type {Map<string, QueueEntry>} */
const pending = new Map();

let flushing = false;
/** @type {Set<string>} */
const inFlightFlush = new Set();
let sweepTimer = null;

/**
 * @typedef {object} QueueEntry
 * @property {string} applicationId
 * @property {string} userId
 * @property {object} options
 * @property {boolean} committed
 * @property {number} enqueuedAt
 * @property {number} committedAt
 * @property {number} attempts
 * @property {number} priorityScore
 * @property {number} [expectedVersion]
 */

function computePriorityScore(entry) {
  let score = 0;
  const opts = entry.options || {};
  if (opts.enteringTerminal || opts.forceRevive) score += 100;
  if (entry.committed) score += 10;
  if (typeof entry.expectedVersion === "number") score += entry.expectedVersion;
  return score;
}

function mergeEntry(existing, incoming) {
  const merged = {
    ...existing,
    userId: incoming.userId || existing.userId,
    enqueuedAt: Math.min(existing.enqueuedAt, incoming.enqueuedAt),
    committed: existing.committed || incoming.committed,
    committedAt: incoming.committedAt || existing.committedAt,
    options: {
      ...existing.options,
      ...incoming.options,
      enteringTerminal:
        Boolean(existing.options?.enteringTerminal) ||
        Boolean(incoming.options?.enteringTerminal),
      forceRevive:
        Boolean(existing.options?.forceRevive) || Boolean(incoming.options?.forceRevive),
    },
    expectedVersion: Math.max(
      existing.expectedVersion ?? 0,
      incoming.expectedVersion ?? 0
    ),
  };
  merged.priorityScore = computePriorityScore(merged);
  return merged;
}

function dropEntry(applicationId, reason, entry) {
  pending.delete(applicationId);
  metrics.increment("orchestration.post_commit.dropped", { reason });
  logRealtimeLifecycle("REALTIME_PUBLISH_DROPPED", {
    applicationId,
    userId: entry?.userId,
    reason,
    via: "post_commit_queue",
  });
}

function evictForOverflow() {
  while (pending.size > MAX_PENDING) {
    const now = Date.now();
    let dropped = false;

    for (const [appId, entry] of [...pending.entries()]) {
      if (!entry.committed && now - entry.enqueuedAt > UNCOMMITTED_TTL_MS) {
        dropEntry(appId, "ttl_expired", entry);
        dropped = true;
        break;
      }
    }
    if (dropped) continue;

    const byApp = new Map();
    for (const [appId, entry] of pending.entries()) {
      if (!entry.committed) {
        const list = byApp.get(appId) || [];
        list.push({ appId, entry });
        byApp.set(appId, list);
      }
    }
    for (const [appId, list] of byApp.entries()) {
      if (list.length > 1) {
        list.sort((a, b) => a.entry.priorityScore - b.entry.priorityScore);
        dropEntry(list[0].appId, "duplicate_superseded", list[0].entry);
        dropped = true;
        break;
      }
    }
    if (dropped) continue;

    const uncommitted = [...pending.entries()].filter(([, e]) => !e.committed);
    const protectedDrop = (e) =>
      e.options?.enteringTerminal || e.options?.forceRevive;

    const droppable = uncommitted.filter(([, e]) => !protectedDrop(e));
    const pool = droppable.length ? droppable : uncommitted;

    pool.sort((a, b) => {
      if (a[1].priorityScore !== b[1].priorityScore) {
        return a[1].priorityScore - b[1].priorityScore;
      }
      return a[1].enqueuedAt - b[1].enqueuedAt;
    });

    if (pool.length) {
      const [appId, entry] = pool[0];
      dropEntry(
        appId,
        protectedDrop(entry) ? "queue_full" : "low_priority",
        entry
      );
      dropped = true;
      continue;
    }
    break;
  }
}

function enqueuePostCommitPublish(applicationId, userId, options = {}) {
  if (!applicationId || !userId) return;

  const incoming = {
    applicationId,
    userId,
    options: { ...options },
    committed: false,
    enqueuedAt: Date.now(),
    committedAt: 0,
    attempts: 0,
    priorityScore: 0,
    expectedVersion: options.expectedVersion ?? 0,
  };
  incoming.priorityScore = computePriorityScore(incoming);

  const existing = pending.get(applicationId);
  if (existing) {
    pending.set(applicationId, mergeEntry(existing, incoming));
  } else {
    pending.set(applicationId, incoming);
    if (pending.size > MAX_PENDING) evictForOverflow();
  }

  metrics.increment("orchestration.post_commit.queued");
  logRealtimeLifecycle("REALTIME_PUBLISH_SCHEDULED", {
    applicationId,
    userId,
    source: options.source || "unknown",
    enteringTerminal: Boolean(options.enteringTerminal),
    forceRevive: Boolean(options.forceRevive),
  });
}

function markApplicationPublishCommitted(applicationId) {
  const entry = pending.get(applicationId);
  if (!entry) return;
  entry.committed = true;
  entry.committedAt = Date.now();
  entry.priorityScore = computePriorityScore(entry);
}

function markAllPendingCommitted() {
  for (const entry of pending.values()) {
    if (!entry.committed) {
      entry.committed = true;
      entry.committedAt = Date.now();
      entry.priorityScore = computePriorityScore(entry);
    }
  }
}

async function flushOne(entry) {
  const { applicationId, userId, options } = entry;
  if (inFlightFlush.has(applicationId)) return;
  inFlightFlush.add(applicationId);
  try {
    enqueuePublishBatch(applicationId, userId, {
      ...options,
      publishSource: options.publishSource || options.source || "post_commit_queue",
    });
    pending.delete(applicationId);
    metrics.increment("orchestration.post_commit.flushed");
    logRealtimeLifecycle("REALTIME_PUBLISH_FLUSHED", {
      applicationId,
      userId,
      via: "post_commit_queue",
    });
  } catch (err) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_FLUSH_ATTEMPTS) {
      dropEntry(applicationId, "flush_exhausted", entry);
      return;
    }
    logRealtimeLifecycle("REALTIME_PUBLISH_FLUSH_RETRY", {
      applicationId,
      userId,
      attempts: entry.attempts,
      error_message: err?.message,
    });
  } finally {
    inFlightFlush.delete(applicationId);
  }
}

async function flushPostCommitPublishes() {
  if (flushing) return;
  flushing = true;
  try {
    const committed = [...pending.values()].filter((e) => e.committed);
    committed.sort((a, b) => b.priorityScore - a.priorityScore);
    for (const entry of committed) {
      await flushOne(entry);
    }
    const { flushPublishBatchNow } = require("./publishBatchProcessor");
    await flushPublishBatchNow();
  } finally {
    flushing = false;
  }
}

function sweepOrphans() {
  const now = Date.now();
  for (const [appId, entry] of [...pending.entries()]) {
    if (!entry.committed && now - entry.enqueuedAt > UNCOMMITTED_TTL_MS) {
      dropEntry(appId, "ttl_expired", entry);
      continue;
    }
    if (entry.committed && now - (entry.committedAt || entry.enqueuedAt) > COMMITTED_FLUSH_TTL_MS) {
      metrics.increment("orchestration.post_commit.orphan_recovery");
      logRealtimeLifecycle("REALTIME_PUBLISH_ORPHAN_RECOVERY", {
        applicationId: appId,
        userId: entry.userId,
      });
      void flushOne(entry);
    }
  }
}

function startPostCommitSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepOrphans, SWEEP_INTERVAL_MS);
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();
}

function resetPostCommitQueueForTests() {
  pending.clear();
  inFlightFlush.clear();
  flushing = false;
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/** Immediate publish for non-transactional API paths. */
async function publishImmediately(applicationId, userId, options = {}) {
  const { flushPublishBatchNow } = require("./publishBatchProcessor");
  enqueuePublishBatch(applicationId, userId, options);
  await flushPublishBatchNow();
}

function scheduleApplicationRealtimePublish(applicationId, userId, options = {}) {
  enqueuePostCommitPublish(applicationId, userId, options);
}

module.exports = {
  enqueuePostCommitPublish,
  markApplicationPublishCommitted,
  markAllPendingCommitted,
  flushPostCommitPublishes,
  publishImmediately,
  scheduleApplicationRealtimePublish,
  startPostCommitSweep,
  resetPostCommitQueueForTests,
};
