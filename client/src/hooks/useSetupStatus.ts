import { useQuery } from "@tanstack/react-query";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

export function useSetupStatus() {
  return useQuery({
    ...setupStatusQueryOptions,
    retry: 2,
    retryDelay: 5000,
  });
}
