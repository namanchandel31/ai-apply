/**
 * Single owner for ["applications"] React Query cache mutations.
 * Events transport state; React Query is the frontend source of truth.
 *
 * Anti-overfetch guardrails (do not regress):
 * - SSE/poll/optimistic/mutations patch rows here only — never invalidate on routine updates.
 * - Poll runs only when SSE is not ready on the leader tab (see useApplicationStatusPoll).
 * - refreshApplicationsList() is for explicit user refresh only.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationRecord, ApplicationStatusPayload } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { applyRealtimeEventToCache, applyPollStatusToCache } from "@/services/realtime/cache/cacheSyncApi";
import { shouldApplyDisplayPatch } from "@/services/realtime/reconciliation/shouldApplyRealtimeEvent";
import { applicationsQueryOptions } from "@/queries/bootstrapQueries";

export const APPLICATIONS_QUERY_KEY = ["applications"] as const;

const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying", "draft"]);

export function getApplicationsQueryOptions() {
  return applicationsQueryOptions;
}

export { shouldApplyDisplayPatch };

function mergeDisplayFields(
  existing: ApplicationRecord,
  incoming: Partial<ApplicationRecord>
): Partial<ApplicationRecord> {
  if (!shouldApplyDisplayPatch(existing, incoming)) {
    return {};
  }
  const patch: Partial<ApplicationRecord> = {};
  if (incoming.updatedAt) patch.updatedAt = incoming.updatedAt;
  if (incoming.role != null && String(incoming.role).trim() !== "") {
    patch.role = incoming.role;
  }
  if (incoming.company != null && String(incoming.company).trim() !== "") {
    patch.company = incoming.company;
  }
  if (incoming.jdEnrichment !== undefined) {
    patch.jdEnrichment = incoming.jdEnrichment;
  }
  return patch;
}

function patchRow(
  current: ApplicationRecord[] | undefined,
  applicationId: string,
  buildPatch: (existing: ApplicationRecord | undefined) => Partial<ApplicationRecord> | null
): ApplicationRecord[] | undefined {
  if (!current) return current;
  let found = false;
  const next = current.map((app) => {
    if (app.id !== applicationId) return app;
    found = true;
    const patch = buildPatch(app);
    if (!patch || Object.keys(patch).length === 0) return app;
    return { ...app, ...patch };
  });
  if (!found) return current;
  return next;
}

/** @deprecated Use applyRealtimeEventToCache from cacheSyncApi */
export function patchApplicationFromEvent(
  queryClient: QueryClient,
  event: ApplicationUpdatedPayload
): void {
  applyRealtimeEventToCache(queryClient, event);
}

/** @deprecated Use applyPollStatusToCache from cacheSyncApi */
export function patchApplicationFromStatus(
  queryClient: QueryClient,
  applicationId: string,
  status: ApplicationStatusPayload
): void {
  applyPollStatusToCache(queryClient, applicationId, status);
}

export function upsertOptimisticApplication(
  queryClient: QueryClient,
  row: ApplicationRecord
): void {
  queryClient.setQueryData<ApplicationRecord[]>(APPLICATIONS_QUERY_KEY, (current) => {
    const list = current ?? [];
    if (list.some((a) => a.id === row.id)) {
      return list.map((a) => (a.id === row.id ? { ...a, ...row } : a));
    }
    return [row, ...list];
  });
}

export function patchApplicationAfterMutation(
  queryClient: QueryClient,
  applicationId: string,
  patch: Partial<ApplicationRecord>
): void {
  queryClient.setQueryData<ApplicationRecord[]>(APPLICATIONS_QUERY_KEY, (current) =>
    patchRow(current, applicationId, () => patch)
  );
}

/** Explicit user refresh only — not for SSE or row updates. */
export function refreshApplicationsList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
}

export function displayRole(app: ApplicationRecord): string {
  if (app.role && String(app.role).trim()) return app.role;
  const ui = app.uiStatus || app.status;
  if (ACTIVE_UI.has(ui) && app.jdEnrichment !== "complete") {
    return "Parsing JD…";
  }
  return "Unknown Role";
}

export function displayCompany(app: ApplicationRecord): string {
  if (app.company && String(app.company).trim()) return app.company;
  const ui = app.uiStatus || app.status;
  if (ACTIVE_UI.has(ui) && app.jdEnrichment !== "complete") {
    return "Parsing JD…";
  }
  return "Unknown Company";
}
