/**
 * Jest mirror of client/src/lib/pollLoopLogic.ts — keep in sync when changing poll logic.
 */
const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);

function isTerminalStatus(app) {
  const ui = (app.uiStatus ?? app.status ?? "").toLowerCase();
  return TERMINAL_UI.has(ui);
}

function shouldPoll(app, attempts, maxAttempts) {
  if (app.terminal === true) return false;
  if (app.pollable === false) return false;
  if (isTerminalStatus(app)) return false;
  if (attempts >= maxAttempts) return false;
  if (app.pollable === undefined && app.terminal === undefined) {
    const ui = app.uiStatus ?? app.status ?? "";
    if (TERMINAL_UI.has(ui)) return false;
  }
  return true;
}

function computePollableIdsKey(applications, getAttempts, maxAttempts) {
  return applications
    .filter((a) => shouldPoll(a, getAttempts(a.id) ?? 0, maxAttempts))
    .map((a) => a.id)
    .sort()
    .join(",");
}

function computeBackoffMs(errorCount, baseMs, maxMs) {
  if (errorCount <= 0) return 0;
  return Math.min(baseMs * 2 ** (errorCount - 1), maxMs);
}

function isAppInBackoff(appId, errorCount, lastErrorAt, now, baseMs, maxMs) {
  if (!lastErrorAt) return false;
  const wait = computeBackoffMs(errorCount, baseMs, maxMs);
  return wait > 0 && now - lastErrorAt < wait;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = {
  shouldPoll,
  computePollableIdsKey,
  computeBackoffMs,
  isAppInBackoff,
  mapWithConcurrency,
};
