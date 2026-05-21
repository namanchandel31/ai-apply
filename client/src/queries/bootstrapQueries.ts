import { api } from "@/lib/api";

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

export const applicationsQueryOptions = {
  queryKey: ["applications"] as const,
  queryFn: async () => {
    const res = await api.getApplications();
    return res.data;
  },
  staleTime: APPLICATIONS_STALE_MS,
  gcTime: APPLICATIONS_STALE_MS * 2,
  ...sharedQueryOptions,
};
