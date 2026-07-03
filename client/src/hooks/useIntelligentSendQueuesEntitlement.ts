import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import { setupStatusQueryOptions } from "@/queries/bootstrapQueries";

/** Plan must explicitly grant `can_use_intelligent_send_queues` (catalog default is false). */
export function useIntelligentSendQueuesEntitlement(): boolean {
  const { isResolved, isAuthenticated } = useAuthReady();
  const { data: setupStatus } = useQuery({
    ...setupStatusQueryOptions,
    enabled: isResolved && isAuthenticated,
  });

  return setupStatus?.entitlements?.can_use_intelligent_send_queues === true;
}
