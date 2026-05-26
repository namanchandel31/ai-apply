import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApplicationsListParams, ApplicationsListSortField } from "@/lib/api";
import {
  defaultApplicationsListParams,
  normalizeApplicationsListParams,
  setStoredPageSize,
} from "@/lib/normalizeApplicationsListParams";

function parseParamsFromSearchParams(sp: URLSearchParams): ApplicationsListParams {
  const base = defaultApplicationsListParams();
  const page = Number(sp.get("page"));
  const pageSize = Number(sp.get("pageSize"));
  const sort = sp.get("sort") as ApplicationsListSortField | null;
  const order = sp.get("order");
  const status = sp.getAll("status").filter(Boolean);
  const datePreset = sp.get("datePreset") as ApplicationsListParams["datePreset"];
  const q = sp.get("q") ?? undefined;

  const params: ApplicationsListParams = {
    page: Number.isFinite(page) && page >= 1 ? page : base.page,
    pageSize: Number.isFinite(pageSize) && pageSize >= 1 ? pageSize : base.pageSize,
    sort: sort ?? base.sort,
    order: order === "asc" ? "asc" : "desc",
  };
  if (status.length) params.status = status;
  if (datePreset) {
    params.datePreset = datePreset;
    if (datePreset === "custom") {
      const dateFrom = sp.get("dateFrom");
      const dateTo = sp.get("dateTo");
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    }
  }
  if (q?.trim()) params.q = q.trim();
  return normalizeApplicationsListParams(params);
}

function paramsToSearchParams(params: ApplicationsListParams): URLSearchParams {
  const p = normalizeApplicationsListParams(params);
  const sp = new URLSearchParams();
  sp.set("page", String(p.page));
  sp.set("pageSize", String(p.pageSize));
  sp.set("sort", p.sort ?? "created_at");
  sp.set("order", p.order ?? "desc");
  if (p.status?.length) {
    for (const s of p.status) sp.append("status", s);
  }
  if (p.datePreset) {
    sp.set("datePreset", p.datePreset);
    if (p.datePreset === "custom") {
      if (p.dateFrom) sp.set("dateFrom", p.dateFrom);
      if (p.dateTo) sp.set("dateTo", p.dateTo);
    }
  }
  if (p.q) sp.set("q", p.q);
  return sp;
}

export function useApplicationsListState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(
    () => parseParamsFromSearchParams(searchParams),
    [searchParams]
  );

  const setParams = useCallback(
    (next: ApplicationsListParams | ((prev: ApplicationsListParams) => ApplicationsListParams)) => {
      const resolved =
        typeof next === "function" ? next(parseParamsFromSearchParams(searchParams)) : next;
      const normalized = normalizeApplicationsListParams(resolved);
      setStoredPageSize(normalized.pageSize);
      setSearchParams(paramsToSearchParams(normalized), { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const patchParams = useCallback(
    (patch: Partial<ApplicationsListParams>, options?: { resetPage?: boolean }) => {
      setParams((prev) => {
        const merged = { ...prev, ...patch };
        if (options?.resetPage !== false && patch.page === undefined) {
          const filterKeys: (keyof ApplicationsListParams)[] = [
            "status",
            "datePreset",
            "dateFrom",
            "dateTo",
            "q",
            "pageSize",
            "sort",
            "order",
          ];
          const changed = filterKeys.some((k) => k in patch);
          if (changed) merged.page = 1;
        }
        return merged;
      });
    },
    [setParams]
  );

  const clearFilters = useCallback(() => {
    const base = defaultApplicationsListParams();
    setParams({
      page: 1,
      pageSize: params.pageSize,
      sort: "created_at",
      order: "desc",
    });
    void base;
  }, [params.pageSize, setParams]);

  const hasActiveFilters = Boolean(
    params.status?.length || params.datePreset || params.q
  );

  return { params, setParams, patchParams, clearFilters, hasActiveFilters };
}
