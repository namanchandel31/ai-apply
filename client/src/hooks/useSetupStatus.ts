import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSetupStatus() {
  return useQuery({
    queryKey: ["setup-status"],
    queryFn: async () => {
      const res = await api.getSetupStatus();
      return res.data;
    },
    retry: 2,
    retryDelay: 5000,
    refetchOnWindowFocus: false,
  });
}
