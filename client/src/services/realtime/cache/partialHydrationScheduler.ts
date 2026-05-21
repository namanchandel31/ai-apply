import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationRecord } from "@/lib/api";
import { applicationsQueryOptions } from "@/queries/bootstrapQueries";
import { APPLICATIONS_QUERY_KEY } from "@/queries/applicationsCache";
import { scheduleListInvalidation } from "./invalidatePolicy";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";

const MAX_CONCURRENT_PARTIAL_HYDRATIONS = 3;
const BATCH_HYDRATE_THRESHOLD = 5;
const BATCH_WINDOW_MS = 200;

const pending = new Set<string>();
const hydrating = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let activeHydrations = 0;

const HYDRATE_FIELDS: (keyof ApplicationRecord)[] = [
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
  "jdEnrichment",
];

function mergeFromListRow(
  partial: ApplicationRecord,
  authoritative: ApplicationRecord
): ApplicationRecord {
  const merged = { ...partial } as ApplicationRecord & { _partial?: boolean };
  for (const key of HYDRATE_FIELDS) {
    const val = authoritative[key];
    if (val !== undefined) {
      (merged as Record<string, unknown>)[key] = val;
    }
  }
  delete (merged as { _partial?: boolean })._partial;
  return merged;
}

function promotePartialsFromList(
  queryClient: QueryClient,
  list: ApplicationRecord[]
): number {
  const byId = new Map(list.map((a) => [a.id, a]));
  let promoted = 0;
  queryClient.setQueryData(APPLICATIONS_QUERY_KEY, (current) => {
    if (!current) return current;
    return current.map((row) => {
      if (!(row as { _partial?: boolean })._partial) return row;
      const authoritative = byId.get(row.id);
      if (!authoritative) return row;
      promoted += 1;
      return mergeFromListRow(row, authoritative);
    });
  });
  return promoted;
}

async function runBatchHydration(queryClient: QueryClient) {
  const ids = [...pending];
  pending.clear();
  if (!ids.length) return;

  metrics.increment("orchestration.cache.hydration_batch");
  try {
    const list = await queryClient.fetchQuery(applicationsQueryOptions);
    const promoted = promotePartialsFromList(queryClient, list);
    logDebug("CACHE_PARTIAL_BATCH_HYDRATED", { count: promoted, component: "cache" }, "cache");
  } catch {
    scheduleListInvalidation("burst_partial", () => {
      void queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
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
    const list = await queryClient.fetchQuery(applicationsQueryOptions);
    promotePartialsFromList(queryClient, list);
    logDebug("CACHE_PARTIAL_HYDRATED", { applicationId, component: "cache" }, "cache");
  } finally {
    hydrating.delete(applicationId);
    activeHydrations -= 1;
    if (pending.size) schedulePartialHydration(queryClient, [...pending][0]);
  }
}

export function schedulePartialHydration(
  queryClient: QueryClient,
  applicationId: string
): void {
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
  activeHydrations = 0;
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = null;
}

/** @internal test helper */
export function mergePartialWithListRowForTests(
  partial: ApplicationRecord,
  authoritative: ApplicationRecord
): ApplicationRecord {
  return mergeFromListRow(partial, authoritative);
}
