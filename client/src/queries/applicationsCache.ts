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
  APPLICATIONS_LIST_KEY_PREFIX,
  applicationsListQueryKey,
  getApplicationsListQueryOptions as buildListOptions,
} from "@/queries/applicationsListQuery";
import { getActiveListParams } from "@/services/realtime/cache/activeListParamsRegistry";
import {
  defaultApplicationsListParams,
  normalizeApplicationsListParams,
} from "@/lib/normalizeApplicationsListParams";
import type { ApplicationsListParams } from "@/lib/api";
import {
  normalizeApplicationsListData,
  recomputeListPages,
} from "@/lib/applicationsListResponse";

/** @deprecated use applicationsListQueryKey */
export const APPLICATIONS_QUERY_KEY = ["applications"] as const;

import { isApplicationJdParsing } from "@/lib/applicationRowState";

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

export function shouldInsertNewRowIntoList(
  params: ApplicationsListParams,
  row: ApplicationRecord
): boolean {
  const normalized = normalizeApplicationsListParams(params);
  if (normalized.page !== 1) return false;
  if (normalized.q?.trim()) return false;
  if (normalized.datePreset) return false;
  if (normalized.status?.length) {
    const appStatus = (row.status || "").toLowerCase();
    const allowed = normalized.status.map((s) => s.toLowerCase());
    if (!allowed.includes(appStatus)) return false;
  }
  return true;
}

export function forEachApplicationsListQuery(
  queryClient: QueryClient,
  update: (
    queryKey: readonly unknown[],
    params: ApplicationsListParams
  ) => void
): void {
  const keys = new Set<string>();

  for (const query of queryClient.getQueryCache().findAll({
    queryKey: APPLICATIONS_LIST_KEY_PREFIX,
  })) {
    const params = query.queryKey[2] as ApplicationsListParams | undefined;
    if (!params) continue;
    keys.add(JSON.stringify(query.queryKey));
    update(query.queryKey, params);
  }

  const defaultKey = applicationsListQueryKey(defaultApplicationsListParams());
  const activeKey = getListQueryKey();
  for (const key of [defaultKey, activeKey]) {
    if (keys.has(JSON.stringify(key))) continue;
    update(key, key[2] as ApplicationsListParams);
  }
}

function upsertRowIntoListPage(
  current: ApplicationsListResponse | undefined,
  row: ApplicationRecord,
  insertNew: boolean
): ApplicationsListResponse {
  const page = normalizeApplicationsListData(current);
  const idx = page.items.findIndex((a) => a.id === row.id);
  if (idx >= 0) {
    const items = [...page.items];
    items[idx] = { ...items[idx], ...row };
    return { ...page, items };
  }
  if (!insertNew) return page;
  return recomputeListPages({
    ...page,
    items: [row, ...page.items],
    totalItems: page.totalItems + 1,
  });
}

export function upsertOptimisticApplication(
  queryClient: QueryClient,
  row: ApplicationRecord
): void {
  forEachApplicationsListQuery(queryClient, (queryKey, params) => {
    queryClient.setQueryData<ApplicationsListResponse>(queryKey, (current) =>
      upsertRowIntoListPage(current, row, shouldInsertNewRowIntoList(params, row))
    );
  });
}

export function removeOptimisticApplication(
  queryClient: QueryClient,
  applicationId: string
): void {
  for (const query of queryClient.getQueryCache().findAll({
    queryKey: APPLICATIONS_LIST_KEY_PREFIX,
  })) {
    queryClient.setQueryData<ApplicationsListResponse>(query.queryKey, (current) => {
      if (!current) return current;
      const page = normalizeApplicationsListData(current);
      const items = page.items.filter((a) => a.id !== applicationId);
      if (items.length === page.items.length) return page;
      return recomputeListPages({
        ...page,
        items,
        totalItems: Math.max(0, page.totalItems - 1),
      });
    });
  }
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

export function bulkPatchApplicationsAfterMutation(
  queryClient: QueryClient,
  applicationIds: string[],
  patch: Partial<ApplicationRecord>
): void {
  const key = getListQueryKey();
  const idSet = new Set(applicationIds);
  queryClient.setQueryData<ApplicationsListResponse>(key, (current) => {
    if (!current) return current;
    const page = normalizeApplicationsListData(current);
    const items = page.items.map((app) =>
      idSet.has(app.id) ? { ...app, ...patch } : app
    );
    return { ...page, items };
  });
}

export function removeApplicationsFromList(
  queryClient: QueryClient,
  applicationIds: string[]
): void {
  const key = getListQueryKey();
  const idSet = new Set(applicationIds);
  queryClient.setQueryData<ApplicationsListResponse>(key, (current) => {
    if (!current) return current;
    const page = normalizeApplicationsListData(current);
    const items = page.items.filter((app) => !idSet.has(app.id));
    const removedCount = page.items.length - items.length;
    if (!removedCount) return page;
    return recomputeListPages({
      ...page,
      items,
      totalItems: Math.max(0, page.totalItems - removedCount),
    });
  });
}

/** Set after a successful apply so Applications can jump back to page 1. */
export const PENDING_NEW_APPLICATION_KEY = "applications:pendingNew";

export function markPendingNewApplication(applicationId: string): void {
  try {
    sessionStorage.setItem(PENDING_NEW_APPLICATION_KEY, applicationId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumePendingNewApplication(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_NEW_APPLICATION_KEY);
    if (id) sessionStorage.removeItem(PENDING_NEW_APPLICATION_KEY);
    return id;
  } catch {
    return null;
  }
}

export function refreshApplicationsList(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: APPLICATIONS_LIST_KEY_PREFIX, type: "active" });
}

export function displayRole(app: ApplicationRecord): string {
  if (app.role && String(app.role).trim()) return app.role;
  if (isApplicationJdParsing(app)) {
    return "Parsing JD…";
  }
  return "Unknown Role";
}

export function displayCompany(app: ApplicationRecord): string {
  if (app.company && String(app.company).trim()) return app.company;
  if (isApplicationJdParsing(app)) {
    return "Parsing JD…";
  }
  return "Unknown Company";
}

export {
  EMPTY_APPLICATIONS_LIST,
  normalizeApplicationsListData,
  getApplicationsListItems,
} from "@/lib/applicationsListResponse";
