import { keepPreviousData } from "@tanstack/react-query";
import { api, type ApplicationsListParams } from "@/lib/api";
import { normalizeApplicationsListParams } from "@/lib/normalizeApplicationsListParams";
import { APPLICATIONS_STALE_MS } from "@/queries/bootstrapQueries";

export const APPLICATIONS_LIST_KEY_PREFIX = ["applications", "list"] as const;

export function applicationsListQueryKey(params: ApplicationsListParams) {
  return [...APPLICATIONS_LIST_KEY_PREFIX, normalizeApplicationsListParams(params)] as const;
}

const sharedQueryOptions = {
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

export function getApplicationsListQueryOptions(params: ApplicationsListParams) {
  const normalized = normalizeApplicationsListParams(params);
  return {
    queryKey: applicationsListQueryKey(normalized),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const res = await api.getApplicationsList(normalized, { signal });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: APPLICATIONS_STALE_MS,
    gcTime: APPLICATIONS_STALE_MS * 2,
    ...sharedQueryOptions,
  };
}
