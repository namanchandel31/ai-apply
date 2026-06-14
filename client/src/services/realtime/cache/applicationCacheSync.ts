import type { QueryClient } from "@tanstack/react-query";
import type {
  ApplicationRecord,
  ApplicationStatusPayload,
  ApplicationsListResponse,
} from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import {
  orchPatchFromEvent,
  shouldApplyDisplayPatch,
} from "@/services/realtime/reconciliation/shouldApplyRealtimeEvent";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";
import { applicationsListQueryKey } from "@/queries/applicationsListQuery";
import { EMAIL_SENT_TRACKER_STATUS_ID } from "@/lib/trackerStatusColors";
import { getActiveListParams } from "./activeListParamsRegistry";
import {
  normalizeApplicationsListData,
  recomputeListPages,
} from "@/lib/applicationsListResponse";
import { schedulePartialHydration } from "./partialHydrationScheduler";
import { PARTIAL_ROW_TTL_MS } from "../convergenceConfig";

const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying", "draft"]);
const lastConvergedAt = new Map<string, number>();
const partialSince = new Map<string, number>();

export function markRowConverged(applicationId: string) {
  lastConvergedAt.set(applicationId, Date.now());
  partialSince.delete(applicationId);
}

export function getLastConvergedAt(applicationId: string): number {
  return lastConvergedAt.get(applicationId) ?? 0;
}

export { shouldApplyDisplayPatch };

function mergeDisplayFields(
  existing: ApplicationRecord,
  incoming: Partial<ApplicationRecord>
): Partial<ApplicationRecord> {
  if (!shouldApplyDisplayPatch(existing, incoming)) return {};
  const patch: Partial<ApplicationRecord> = {};
  if (incoming.updatedAt) patch.updatedAt = incoming.updatedAt;
  if (incoming.role != null && String(incoming.role).trim() !== "") patch.role = incoming.role;
  if (incoming.company != null && String(incoming.company).trim() !== "") {
    patch.company = incoming.company;
  }
  if (incoming.jdEnrichment !== undefined) patch.jdEnrichment = incoming.jdEnrichment;
  if (typeof incoming.matchScore === "number" && !Number.isNaN(incoming.matchScore)) {
    patch.matchScore = incoming.matchScore;
  }
  return patch;
}

function buildPartialRow(event: ApplicationUpdatedPayload): ApplicationRecord {
  const ui = event.uiStatus || event.status || "draft";
  return {
    id: event.applicationId,
    status: event.status ?? ui,
    uiStatus: ui,
    terminal: event.terminal ?? false,
    executionTerminal: event.executionTerminal ?? false,
    pollable: event.pollable ?? true,
    canRetry: event.canRetry ?? false,
    canContinue: event.canContinue ?? false,
    createdAt: event.updatedAt ?? new Date().toISOString(),
    updatedAt: event.updatedAt ?? new Date().toISOString(),
    role: event.role ?? (ACTIVE_UI.has(ui) ? "Parsing JD…" : "Unknown Role"),
    company: event.company ?? (ACTIVE_UI.has(ui) ? "Parsing JD…" : "Unknown Company"),
    _partial: true,
  } as ApplicationRecord;
}

function applyPatchToPaginatedList(
  current: ApplicationsListResponse | ApplicationRecord[] | undefined,
  applicationId: string,
  buildPatch: (existing: ApplicationRecord | undefined) => Partial<ApplicationRecord> | null
): ApplicationsListResponse | undefined {
  const page = normalizeApplicationsListData(current);
  const items = page.items ?? [];
  const idx = items.findIndex((a) => a.id === applicationId);
  const existing = idx >= 0 ? items[idx] : undefined;
  const patch = buildPatch(existing);
  if (!patch || Object.keys(patch).length === 0) {
    if (idx >= 0 && (existing as { _partial?: boolean } | undefined)?._partial) {
      const nextItems = [...items];
      const merged = { ...existing! } as ApplicationRecord & { _partial?: boolean };
      delete merged._partial;
      partialSince.delete(applicationId);
      nextItems[idx] = merged;
      return { ...page, items: nextItems };
    }
    return current as ApplicationsListResponse | undefined;
  }

  if (idx >= 0) {
    const nextItems = [...items];
    const merged = { ...existing!, ...patch } as ApplicationRecord & { _partial?: boolean };
    // Authoritative patches must not leave placeholder rows stuck in partial-hydrate loop.
    delete merged._partial;
    nextItems[idx] = merged;
    return { ...page, items: nextItems };
  }

  const partial = buildPartialRow({
    applicationId,
    ...patch,
    type: "application.updated",
    channel: "applications",
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  } as ApplicationUpdatedPayload);
  partialSince.set(applicationId, Date.now());
  metrics.increment("orchestration.cache.partial_upsert");
  return recomputeListPages({
    ...page,
    items: [partial, ...items],
    totalItems: page.totalItems + 1,
  });
}

function logCachePatchDecision(
  event: ApplicationUpdatedPayload,
  existing: ApplicationRecord | undefined,
  merged: Partial<ApplicationRecord>,
  rowReason?: string
): void {
  if (!isDebugEnabled("reconciliation")) return;
  const registry = globalOrchestrationRegistry.get(event.applicationId);
  const apply = Object.keys(merged).length > 0;
  logDebug(
    "CACHE_ORCH_PATCH",
    {
      applicationId: event.applicationId,
      incomingStatus: event.status,
      incomingUiStatus: event.uiStatus,
      cachedStatus: existing?.status,
      cachedUiStatus: existing?.uiStatus,
      incomingVersion: event.version ?? 0,
      cachedVersion: registry?.lastVersion,
      incomingEpoch: event.orchestrationEpoch ?? 0,
      cachedEpoch: registry?.orchestrationEpoch,
      apply,
      reason: rowReason,
      component: "cache",
    },
    "reconciliation"
  );
}

function buildEventRowPatch(
  event: ApplicationUpdatedPayload,
  existing: ApplicationRecord | undefined,
  registryEpoch: number
): Partial<ApplicationRecord> | null {
  const orch = orchPatchFromEvent(event, existing, registryEpoch);
  const display = mergeDisplayFields(existing ?? ({} as ApplicationRecord), {
    role: event.role,
    company: event.company,
    jdEnrichment: event.jdEnrichment,
    matchScore: event.matchScore,
    updatedAt: event.updatedAt,
  });
  const merged = { ...orch, ...display };
  const incomingUi = event.uiStatus || event.status;
  if (incomingUi === "sent") {
    merged.trackerStatusId = EMAIL_SENT_TRACKER_STATUS_ID;
  }
  if (
    isDebugEnabled("reconciliation") &&
    typeof event.matchScore === "number" &&
    existing?.matchScore !== event.matchScore
  ) {
    logDebug(
      "CACHE_MATCH_SCORE_PATCH",
      {
        applicationId: event.applicationId,
        previous: existing?.matchScore ?? null,
        incoming: event.matchScore,
        applied: merged.matchScore === event.matchScore,
        component: "cache",
      },
      "reconciliation"
    );
  }
  logCachePatchDecision(event, existing, merged);
  if (Object.keys(merged).length === 0) {
    metrics.increment("orchestration.sse.event_rejected", {
      reason: "row_guard_or_empty",
    });
    return null;
  }
  return merged;
}

export type ApplyRealtimeCacheOptions = {
  /** When true, do not enqueue partial-row hydration (used by hydration itself). */
  skipPartialSchedule?: boolean;
};

/** Apply multiple SSE/poll events in one list cache write (one React Query notify). */
export function applyRealtimeEventsToCache(
  queryClient: QueryClient,
  events: ApplicationUpdatedPayload[],
  options?: ApplyRealtimeCacheOptions
): void {
  const valid = events.filter((e) => !e.type || e.type === "application.updated");
  if (!valid.length) return;

  const listKey = applicationsListQueryKey(getActiveListParams());
  queryClient.setQueryData<ApplicationsListResponse>(listKey, (current) => {
    let page = normalizeApplicationsListData(current);
    for (const event of valid) {
      const registry = globalOrchestrationRegistry.get(event.applicationId);
      const registryEpoch = registry?.orchestrationEpoch ?? 0;
      const next = applyPatchToPaginatedList(page, event.applicationId, (existing) =>
        buildEventRowPatch(event, existing, registryEpoch)
      );
      if (next) {
        page = normalizeApplicationsListData(next);
      }
    }
    return page;
  });

  const page = normalizeApplicationsListData(
    queryClient.getQueryData<ApplicationsListResponse>(listKey)
  );
  if (options?.skipPartialSchedule) {
    for (const event of valid) {
      markRowConverged(event.applicationId);
    }
    return;
  }

  for (const event of valid) {
    const row = page.items.find((a) => a.id === event.applicationId);
    if ((row as { _partial?: boolean } | undefined)?._partial) {
      schedulePartialHydration(queryClient, event.applicationId);
    } else {
      markRowConverged(event.applicationId);
      metrics.increment("orchestration.sse.event_applied");
      logDebug(
        "SSE_EVENT_APPLIED",
        { applicationId: event.applicationId, component: "cache" },
        "reconciliation"
      );
    }
  }
}

export function applyRealtimeEventToCache(
  queryClient: QueryClient,
  event: ApplicationUpdatedPayload,
  options?: ApplyRealtimeCacheOptions
): void {
  applyRealtimeEventsToCache(queryClient, [event], options);
}

export function applyPollStatusToCache(
  queryClient: QueryClient,
  applicationId: string,
  status: ApplicationStatusPayload
): void {
  const event: ApplicationUpdatedPayload = {
    ...status,
    applicationId,
    type: "application.updated",
    channel: "applications",
    updatedAt: status.updatedAt ?? new Date().toISOString(),
    role: status.role,
    company: status.company,
    matchScore: status.matchScore,
    jdEnrichment: status.jdEnrichment,
  };
  applyRealtimeEventToCache(queryClient, event);
}

export function getStaleApplicationIds(
  now: number,
  maxStaleMs: number
): string[] {
  const stale: string[] = [];
  for (const [id, at] of lastConvergedAt) {
    if (now - at > maxStaleMs) stale.push(id);
  }
  for (const [id, since] of partialSince) {
    if (now - since > PARTIAL_ROW_TTL_MS) stale.push(id);
  }
  return [...new Set(stale)];
}

export function resetApplicationCacheSyncForTests() {
  lastConvergedAt.clear();
  partialSince.clear();
}
