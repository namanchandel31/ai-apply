import { keepPreviousData, replaceEqualDeep } from "@tanstack/react-query";
import { api, type ApplicationsListParams, type ApplicationsListResponse } from "@/lib/api";
import { normalizeApplicationsListParams } from "@/lib/normalizeApplicationsListParams";
import { APPLICATIONS_STALE_MS } from "@/queries/bootstrapQueries";
import { preservePipelineStatusOnListRefetch } from "@/lib/applicationsListResponse";

export const APPLICATIONS_LIST_KEY_PREFIX = ["applications", "list"] as const;

export function applicationsListQueryKey(params: ApplicationsListParams) {
  return [...APPLICATIONS_LIST_KEY_PREFIX, normalizeApplicationsListParams(params)] as const;
}

const sharedQueryOptions = {
  // Always reconcile with server when the Applications view mounts (hard refresh / tab return).
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: true as const,
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
    structuralSharing: (oldData, newData) => {
      const merged = preservePipelineStatusOnListRefetch(
        oldData as ApplicationsListResponse | undefined,
        newData as ApplicationsListResponse
      );
      return replaceEqualDeep(oldData, merged);
    },
    staleTime: APPLICATIONS_STALE_MS,
    gcTime: APPLICATIONS_STALE_MS * 2,
    ...sharedQueryOptions,
  };
}
