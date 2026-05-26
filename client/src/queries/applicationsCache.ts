/**
 * Single owner for applications list React Query cache mutations.
 */
import type { QueryClient } from "@tanstack/react-query";
import type {
  ApplicationRecord,
  ApplicationStatusPayload,
  ApplicationsListResponse,
} from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { applyRealtimeEventToCache, applyPollStatusToCache } from "@/services/realtime/cache/cacheSyncApi";
import { shouldApplyDisplayPatch } from "@/services/realtime/reconciliation/shouldApplyRealtimeEvent";
import {
  applicationsListQueryKey,
  getApplicationsListQueryOptions as buildListOptions,
} from "@/queries/applicationsListQuery";
import { getActiveListParams } from "@/services/realtime/cache/activeListParamsRegistry";
import { defaultApplicationsListParams } from "@/lib/normalizeApplicationsListParams";
import {
  normalizeApplicationsListData,
  recomputeListPages,
} from "@/lib/applicationsListResponse";

/** @deprecated use applicationsListQueryKey */
export const APPLICATIONS_QUERY_KEY = ["applications"] as const;

const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying", "draft"]);

export function getListQueryKey() {
  return applicationsListQueryKey(getActiveListParams());
}

export function getApplicationsQueryOptions() {
  return buildListOptions(getActiveListParams());
}

export { shouldApplyDisplayPatch };

function patchItemsArray(
  items: ApplicationRecord[],
  applicationId: string,
  buildPatch: (existing: ApplicationRecord | undefined) => Partial<ApplicationRecord> | null
): { items: ApplicationRecord[]; changed: boolean } {
  let found = false;
  const next = items.map((app) => {
    if (app.id !== applicationId) return app;
    found = true;
    const patch = buildPatch(app);
    if (!patch || Object.keys(patch).length === 0) return app;
    return { ...app, ...patch };
  });
  return { items: found ? next : items, changed: found };
}

function patchPaginatedList(
  current: ApplicationsListResponse | ApplicationRecord[] | undefined,
  applicationId: string,
  buildPatch: (existing: ApplicationRecord | undefined) => Partial<ApplicationRecord> | null
): ApplicationsListResponse | undefined {
  if (!current) return current;
  const page = normalizeApplicationsListData(current);
  const { items, changed } = patchItemsArray(page.items, applicationId, buildPatch);
  if (!changed) return page;
  return { ...page, items };
}

export function patchApplicationFromEvent(
  queryClient: QueryClient,
  event: ApplicationUpdatedPayload
): void {
  applyRealtimeEventToCache(queryClient, event);
}

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
  const key = applicationsListQueryKey(defaultApplicationsListParams());
  queryClient.setQueryData<ApplicationsListResponse>(key, (current) => {
    const page = normalizeApplicationsListData(current);
    const exists = page.items.some((a) => a.id === row.id);
    if (exists) {
      return {
        ...page,
        items: page.items.map((a) => (a.id === row.id ? { ...a, ...row } : a)),
      };
    }
    return recomputeListPages({
      ...page,
      items: [row, ...page.items],
      totalItems: page.totalItems + 1,
    });
  });
}

export function patchApplicationAfterMutation(
  queryClient: QueryClient,
  applicationId: string,
  patch: Partial<ApplicationRecord>
): void {
  const key = getListQueryKey();
  queryClient.setQueryData<ApplicationsListResponse>(key, (current) =>
    patchPaginatedList(current, applicationId, () => patch)
  );
}

export function refreshApplicationsList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["applications", "list"] });
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

export {
  EMPTY_APPLICATIONS_LIST,
  normalizeApplicationsListData,
  getApplicationsListItems,
} from "@/lib/applicationsListResponse";
