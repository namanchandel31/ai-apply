import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import { api } from "@/lib/api";
import { shutdownRealtimeSession } from "@/contexts/RealtimeProvider";
import { resetOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";

/**
 * Full session teardown on logout.
 * Uses queryClient.clear() until shared/public cache domains exist;
 * then migrate to removeQueries(predicate) for auth-scoped keys only.
 */
export function logout(queryClient: QueryClient, navigate: NavigateFunction): void {
  shutdownRealtimeSession();
  api.setToken(null);
  queryClient.clear();
  resetOrchestrationRegistry();
  navigate("/login", { replace: true });
}
