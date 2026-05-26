import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";
export function useSetupStatus() {
  const { isResolved, isAuthenticated } = useAuthReady();
  const enabled = isResolved && isAuthenticated;

  return useQuery({
    ...setupStatusQueryOptions,
    enabled,
    retry: (failureCount, error) => {
      if (!enabled) return false;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    retryDelay: 5000,
  });
}
