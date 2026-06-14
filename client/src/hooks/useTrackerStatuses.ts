import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sortTrackerStatusOptions } from "@/lib/trackerStatusColors";

export const TRACKER_STATUSES_QUERY_KEY = ["tracker-statuses"] as const;

export function useTrackerStatuses() {
  return useQuery({
    queryKey: TRACKER_STATUSES_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getTrackerStatuses();
      return sortTrackerStatusOptions(res.data.options);
    },
    staleTime: 60_000,
  });
}
