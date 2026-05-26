import { api } from "@/lib/api";
import { EMPTY_APPLICATIONS_LIST } from "@/lib/applicationsListResponse";
import { defaultApplicationsListParams } from "@/lib/normalizeApplicationsListParams";
import { getApplicationsListQueryOptions } from "@/queries/applicationsListQuery";

export const SETUP_STATUS_STALE_MS = 5 * 60 * 1000;
export const APPLICATIONS_STALE_MS = 60 * 1000;

const sharedQueryOptions = {
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

export const setupStatusQueryOptions = {
  queryKey: ["setup-status"] as const,
  queryFn: async () => {
    const res = await api.getSetupStatus();
    return res.data;
  },
  staleTime: SETUP_STATUS_STALE_MS,
  gcTime: SETUP_STATUS_STALE_MS * 2,
  ...sharedQueryOptions,
};

/** Default page-1 list for bootstrap prefetch */
export const applicationsQueryOptions = getApplicationsListQueryOptions(
  defaultApplicationsListParams()
);

export { EMPTY_APPLICATIONS_LIST };
