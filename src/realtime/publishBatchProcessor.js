const PUBLISH_BATCH_FLUSH_MS = 75;

/** @type {Map<string, { applicationId: string, userId: string, options: object, priorityScore: number }>} */
const pending = new Map();
let flushTimer = null;

function computePriority(options = {}) {
  let score = 0;
  if (options.enteringTerminal) score += 100;
  if (options.forceRevive) score += 100;
  if (typeof options.expectedVersion === "number") score += options.expectedVersion;
  return score;
}

function mergeEntry(existing, incoming) {
  const mergedOptions = {
    ...existing.options,
    ...incoming.options,
    enteringTerminal:
      Boolean(existing.options?.enteringTerminal) ||
      Boolean(incoming.options?.enteringTerminal),
    forceRevive:
      Boolean(existing.options?.forceRevive) || Boolean(incoming.options?.forceRevive),
    publishSource: incoming.options?.publishSource || existing.options?.publishSource,
  };
  const score = Math.max(
    computePriority(existing.options),
    computePriority(incoming.options)
  );
  return {
    applicationId: incoming.applicationId,
    userId: incoming.userId || existing.userId,
    options: mergedOptions,
    priorityScore: score,
  };
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBatch();
  }, PUBLISH_BATCH_FLUSH_MS);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

async function flushBatch() {
  if (!pending.size) return;
  const entries = [...pending.values()];
  pending.clear();
  entries.sort((a, b) => b.priorityScore - a.priorityScore);

  const { publishApplicationUpdate } = require("./publishApplicationUpdate");
  for (const entry of entries) {
    await publishApplicationUpdate(entry.applicationId, entry.userId, entry.options);
  }
}

function enqueuePublishBatch(applicationId, userId, options = {}) {
  if (!applicationId || !userId) return;
  const incoming = {
    applicationId,
    userId,
    options: { ...options },
    priorityScore: computePriority(options),
  };
  const existing = pending.get(applicationId);
  if (existing) {
    pending.set(applicationId, mergeEntry(existing, incoming));
  } else {
    pending.set(applicationId, incoming);
  }
  scheduleFlush();
}

function flushPublishBatchNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flushBatch();
}

function resetPublishBatchForTests() {
  pending.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

module.exports = {
  PUBLISH_BATCH_FLUSH_MS,
  enqueuePublishBatch,
  flushPublishBatchNow,
  resetPublishBatchForTests,
};
