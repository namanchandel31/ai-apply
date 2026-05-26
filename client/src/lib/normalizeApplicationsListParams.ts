import type { ApplicationsListParams } from "@/lib/api";

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
export const PAGE_SIZE_STORAGE_KEY = "ai_apply_applications_page_size";

const SORT_FIELDS = [
  "created_at",
  "updated_at",
  "match_score",
  "normalized_company_name",
  "application_status",
] as const;

export function getStoredPageSize(): number {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = raw ? Number(raw) : 20;
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 20;
  } catch {
    return 20;
  }
}

export function setStoredPageSize(size: number): void {
  if (PAGE_SIZE_OPTIONS.includes(size as (typeof PAGE_SIZE_OPTIONS)[number])) {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
  }
}

export function defaultApplicationsListParams(): ApplicationsListParams {
  return {
    page: 1,
    pageSize: getStoredPageSize(),
    sort: "created_at",
    order: "desc",
  };
}

/** Stable shape for React Query keys and API requests. */
export function normalizeApplicationsListParams(
  params: ApplicationsListParams
): ApplicationsListParams {
  const defaults = defaultApplicationsListParams();
  const sort = SORT_FIELDS.includes(params.sort as (typeof SORT_FIELDS)[number])
    ? params.sort
    : defaults.sort;
  const order = params.order === "asc" ? "asc" : "desc";
  const pageSize = PAGE_SIZE_OPTIONS.includes(
    params.pageSize as (typeof PAGE_SIZE_OPTIONS)[number]
  )
    ? params.pageSize!
    : defaults.pageSize;
  const page = Math.max(1, params.page ?? 1);

  const normalized: ApplicationsListParams = {
    page,
    pageSize,
    sort: sort ?? "created_at",
    order,
  };

  if (params.status?.length) {
    normalized.status = [...params.status].sort();
  }
  if (params.datePreset) {
    normalized.datePreset = params.datePreset;
    if (params.datePreset === "custom") {
      if (params.dateFrom) normalized.dateFrom = params.dateFrom;
      if (params.dateTo) normalized.dateTo = params.dateTo;
    }
  }
  const q = params.q?.trim();
  if (q) normalized.q = q;

  return normalized;
}

export function buildApplicationsListQueryString(params: ApplicationsListParams): string {
  const p = normalizeApplicationsListParams(params);
  const sp = new URLSearchParams();
  sp.set("page", String(p.page));
  sp.set("pageSize", String(p.pageSize));
  sp.set("sort", p.sort ?? "created_at");
  sp.set("order", p.order ?? "desc");
  if (p.status?.length) {
    for (const s of p.status) sp.append("status", s);
  }
  if (p.datePreset) sp.set("datePreset", p.datePreset);
  if (p.dateFrom) sp.set("dateFrom", p.dateFrom);
  if (p.dateTo) sp.set("dateTo", p.dateTo);
  if (p.q) sp.set("q", p.q);
  return sp.toString();
}
