import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationRecord } from "@/lib/api";
import { api } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { applyRealtimeEventsToCache } from "./applicationCacheSync";
import { scheduleListInvalidation } from "./invalidatePolicy";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";

const MAX_CONCURRENT_PARTIAL_HYDRATIONS = 3;
const BATCH_HYDRATE_THRESHOLD = 5;
const BATCH_WINDOW_MS = 200;

const pending = new Set<string>();
const hydrating = new Set<string>();
const hydrateCooldownUntil = new Map<string, number>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let activeHydrations = 0;

const HYDRATE_COOLDOWN_MS = 30_000;
const MAX_HEAL_IDS_PER_CYCLE = 25;

function statusToEvent(
  applicationId: string,
  data: ApplicationUpdatedPayload
): ApplicationUpdatedPayload {
  return {
    ...data,
    applicationId,
    type: "application.updated",
    channel: "applications",
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

async function fetchStatusEvent(
  applicationId: string
): Promise<ApplicationUpdatedPayload | null> {
  const res = await api.getApplicationStatus(applicationId);
  if (res.notModified) return null;
  return statusToEvent(applicationId, {
    ...res.data,
    applicationId,
    updatedAt: res.data.updatedAt ?? new Date().toISOString(),
  });
}

async function hydrateIds(queryClient: QueryClient, ids: string[]): Promise<number> {
  const events: ApplicationUpdatedPayload[] = [];
  for (const applicationId of ids) {
    try {
      const event = await fetchStatusEvent(applicationId);
      if (event) events.push(event);
    } catch {
      // skip failed id; list invalidation may recover
    }
  }
  if (events.length) {
    applyRealtimeEventsToCache(queryClient, events, { skipPartialSchedule: true });
    const until = Date.now() + HYDRATE_COOLDOWN_MS;
    for (const event of events) {
      hydrateCooldownUntil.set(event.applicationId, until);
    }
  }
  return events.length;
}

/** Batched status fetch + single list cache write (convergence heal, watchdog). */
export async function hydrateApplicationStatuses(
  queryClient: QueryClient,
  applicationIds: string[]
): Promise<number> {
  const ids = [...new Set(applicationIds)].slice(0, MAX_HEAL_IDS_PER_CYCLE);
  if (!ids.length) return 0;
  return hydrateIds(queryClient, ids);
}

async function runBatchHydration(queryClient: QueryClient) {
  const ids = [...pending];
  pending.clear();
  if (!ids.length) return;

  metrics.increment("orchestration.cache.hydration_batch");
  try {
    const promoted = await hydrateIds(queryClient, ids);
    logDebug("CACHE_PARTIAL_BATCH_HYDRATED", { count: promoted, component: "cache" }, "cache");
  } catch {
    scheduleListInvalidation("burst_partial", () => {
      void queryClient.invalidateQueries({ queryKey: ["applications", "list"] });
    });
  }
}

async function runSingleHydration(queryClient: QueryClient, applicationId: string) {
  if (hydrating.has(applicationId)) return;
  if (activeHydrations >= MAX_CONCURRENT_PARTIAL_HYDRATIONS) {
    pending.add(applicationId);
    return;
  }

  hydrating.add(applicationId);
  activeHydrations += 1;
  metrics.increment("orchestration.cache.hydration_scheduled");

  try {
    await hydrateIds(queryClient, [applicationId]);
    logDebug("CACHE_PARTIAL_HYDRATED", { applicationId, component: "cache" }, "cache");
  } catch {
    scheduleListInvalidation("burst_partial", () => {
      void queryClient.invalidateQueries({ queryKey: ["applications", "list"] });
    });
  } finally {
    hydrating.delete(applicationId);
    activeHydrations -= 1;
    if (pending.size > 0) {
      void runBatchHydration(queryClient);
    }
  }
}

export function schedulePartialHydration(
  queryClient: QueryClient,
  applicationId: string
): void {
  const now = Date.now();
  if ((hydrateCooldownUntil.get(applicationId) ?? 0) > now) {
    metrics.increment("orchestration.cache.hydration_coalesced");
    return;
  }

  if (hydrating.has(applicationId)) {
    metrics.increment("orchestration.cache.hydration_coalesced");
    return;
  }

  pending.add(applicationId);
  metrics.increment("orchestration.cache.hydration_scheduled");

  if (pending.size >= BATCH_HYDRATE_THRESHOLD) {
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(() => {
      batchTimer = null;
      void runBatchHydration(queryClient);
    }, BATCH_WINDOW_MS);
    return;
  }

  void runSingleHydration(queryClient, applicationId);
}

export function resetPartialHydrationSchedulerForTests() {
  pending.clear();
  hydrating.clear();
  hydrateCooldownUntil.clear();
  activeHydrations = 0;
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = null;
}

/** @internal test helper */
export function mergePartialWithListRowForTests(
  partial: ApplicationRecord,
  authoritative: ApplicationRecord
): ApplicationRecord {
  const merged = { ...partial } as ApplicationRecord & { _partial?: boolean };
  for (const key of [
    "status",
    "uiStatus",
    "terminal",
    "executionTerminal",
    "pollable",
    "canRetry",
    "canContinue",
    "reviewReason",
    "updatedAt",
    "role",
    "company",
    "matchScore",
    "jdEnrichment",
  ] as const) {
    const val = authoritative[key];
    if (val !== undefined) {
      (merged as Record<string, unknown>)[key] = val;
    }
  }
  delete (merged as { _partial?: boolean })._partial;
  return merged;
}
