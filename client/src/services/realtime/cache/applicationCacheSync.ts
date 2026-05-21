import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationRecord, ApplicationStatusPayload } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import {
  orchPatchFromEvent,
  shouldApplyDisplayPatch,
} from "@/services/realtime/reconciliation/shouldApplyRealtimeEvent";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";
import { APPLICATIONS_QUERY_KEY } from "@/queries/applicationsCache";
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
    updatedAt: event.updatedAt ?? new Date().toISOString(),
    role: event.role ?? (ACTIVE_UI.has(ui) ? "Parsing JD…" : "Unknown Role"),
    company: event.company ?? (ACTIVE_UI.has(ui) ? "Parsing JD…" : "Unknown Company"),
    _partial: true,
  } as ApplicationRecord;
}

function applyPatchToList(
  current: ApplicationRecord[] | undefined,
  applicationId: string,
  buildPatch: (existing: ApplicationRecord | undefined) => Partial<ApplicationRecord> | null
): ApplicationRecord[] | undefined {
  const list = current ?? [];
  const idx = list.findIndex((a) => a.id === applicationId);
  const existing = idx >= 0 ? list[idx] : undefined;
  const patch = buildPatch(existing);
  if (!patch || Object.keys(patch).length === 0) return current;

  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...existing!, ...patch };
    return next;
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
  return [partial, ...list];
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

export function applyRealtimeEventToCache(
  queryClient: QueryClient,
  event: ApplicationUpdatedPayload
): void {
  if (event.type && event.type !== "application.updated") return;

  const registry = globalOrchestrationRegistry.get(event.applicationId);
  const registryEpoch = registry?.orchestrationEpoch ?? 0;

  queryClient.setQueryData<ApplicationRecord[]>(APPLICATIONS_QUERY_KEY, (current) =>
    applyPatchToList(current, event.applicationId, (existing) => {
      const orch = orchPatchFromEvent(event, existing, registryEpoch);
      const display = mergeDisplayFields(existing ?? ({} as ApplicationRecord), {
        role: event.role,
        company: event.company,
        jdEnrichment: event.jdEnrichment,
        updatedAt: event.updatedAt,
      });
      const merged = { ...orch, ...display };
      logCachePatchDecision(event, existing, merged);
      if (Object.keys(merged).length === 0) {
        metrics.increment("orchestration.sse.event_rejected", {
          reason: "row_guard_or_empty",
        });
        return null;
      }
      return merged;
    })
  );

  const row = queryClient
    .getQueryData<ApplicationRecord[]>(APPLICATIONS_QUERY_KEY)
    ?.find((a) => a.id === event.applicationId);

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
