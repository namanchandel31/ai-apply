import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const TRACKER_STATUS_SUMMARY_QUERY_KEY = ["tracker-status-summary"] as const;

export function useTrackerStatusSummary(enabled = true) {
  return useQuery({
    queryKey: TRACKER_STATUS_SUMMARY_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getTrackerStatusSummary();
      return res.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
