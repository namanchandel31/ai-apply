import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import { api } from "@/lib/api";

export function useAiCredentials() {
  const { isResolved, isAuthenticated } = useAuthReady();

  return useQuery({
    queryKey: ["ai-credentials"],
    queryFn: async () => {
      const res = await api.listAiCredentials();
      return res.data ?? [];
    },
    enabled: isResolved && isAuthenticated,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}
