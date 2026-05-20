import type { ApplicationRecord } from "@/lib/api";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";

const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);

type PollableApp = Pick<
  ApplicationRecord,
  "id" | "terminal" | "pollable" | "uiStatus" | "status"
>;

function isTerminalStatus(app: PollableApp): boolean {
  const ui = (app.uiStatus ?? app.status ?? "").toLowerCase();
  return TERMINAL_UI.has(ui);
}

export function shouldPollCore(
  app: PollableApp,
  attempts: number,
  maxAttempts: number
): boolean {
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

/** Stable key from orchestration registry (source of truth for poll membership). */
export function computePollableIdsKeyFromRegistry(maxAttempts: number, now = Date.now()): string {
  return globalOrchestrationRegistry.getPollableIdsKey(maxAttempts, now);
}

/** @deprecated Prefer computePollableIdsKeyFromRegistry after syncFromPresentation. */
export function computePollableIdsKey(
  applications: ApplicationRecord[],
  _getAttempts: (id: string) => number,
  maxAttempts: number
): string {
  globalOrchestrationRegistry.syncFromPresentation(applications);
  return globalOrchestrationRegistry.getPollableIdsKey(maxAttempts);
}

export function computeBackoffMs(errorCount: number, baseMs: number, maxMs: number): number {
  if (errorCount <= 0) return 0;
  return Math.min(baseMs * 2 ** (errorCount - 1), maxMs);
}

export function isAppInBackoff(
  _appId: string,
  errorCount: number,
  lastErrorAt: number | undefined,
  now: number,
  baseMs: number,
  maxMs: number
): boolean {
  if (!lastErrorAt) return false;
  const wait = computeBackoffMs(errorCount, baseMs, maxMs);
  return wait > 0 && now - lastErrorAt < wait;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
