import type { ApplicationRecord, ApplicationsListResponse } from "@/lib/api";
import { preservePipelineStatusFromExisting } from "@/lib/applicationPipelineRank";

export type { ApplicationsListResponse };

export const EMPTY_APPLICATIONS_LIST: ApplicationsListResponse = {
  items: [],
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: 20,
};

/** Coerce legacy flat arrays or partial objects into a paginated list shape. */
export function normalizeApplicationsListData(
  data: ApplicationsListResponse | ApplicationRecord[] | unknown | undefined
): ApplicationsListResponse {
  if (data == null) {
    return { ...EMPTY_APPLICATIONS_LIST };
  }
  if (Array.isArray(data)) {
    const pageSize = data.length > 0 ? data.length : EMPTY_APPLICATIONS_LIST.pageSize;
    return {
      items: data,
      totalItems: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      currentPage: 1,
      pageSize,
    };
  }
  if (typeof data === "object" && data !== null && "items" in data) {
    const page = data as ApplicationsListResponse;
    const items = Array.isArray(page.items) ? page.items : [];
    const pageSize = page.pageSize ?? EMPTY_APPLICATIONS_LIST.pageSize;
    const totalItems = page.totalItems ?? items.length;
    const totalPages =
      page.totalPages ??
      (totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / pageSize)));
    return {
      items,
      totalItems,
      totalPages,
      currentPage: page.currentPage ?? 1,
      pageSize,
    };
  }
  return { ...EMPTY_APPLICATIONS_LIST };
}

export function getApplicationsListItems(
  data: ApplicationsListResponse | ApplicationRecord[] | unknown | undefined
): ApplicationRecord[] {
  return normalizeApplicationsListData(data).items;
}

export function recomputeListPages(
  page: ApplicationsListResponse
): ApplicationsListResponse {
  const totalPages =
    page.totalItems === 0 ? 0 : Math.max(1, Math.ceil(page.totalItems / page.pageSize));
  return { ...page, totalPages };
}

/** Prevent list refetches from downgrading live pipeline status (e.g. queued_sending → processing). */
export function preservePipelineStatusOnListRefetch(
  previous: ApplicationsListResponse | ApplicationRecord[] | undefined,
  next: ApplicationsListResponse
): ApplicationsListResponse {
  const prev = normalizeApplicationsListData(previous);
  if (!prev.items.length) return next;
  const prevById = new Map(prev.items.map((row) => [row.id, row]));
  const items = next.items.map((row) => {
    const existing = prevById.get(row.id);
    return preservePipelineStatusFromExisting(row, existing);
  });
  return items === next.items ? next : { ...next, items };
}
