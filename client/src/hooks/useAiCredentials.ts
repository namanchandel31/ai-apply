import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAiCredentials() {
  return useQuery({
    queryKey: ["ai-credentials"],
    queryFn: async () => {
      const res = await api.listAiCredentials();
      return res.data ?? [];
    },
  });
}
