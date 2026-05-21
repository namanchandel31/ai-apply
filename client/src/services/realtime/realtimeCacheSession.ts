import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeCoordinator } from "./realtimeCoordinator";
import {
  applyRealtimeEventToCache,
  runConvergenceHeal,
} from "./cache/cacheSyncApi";
import { STALE_WATCHDOG_INTERVAL_MS } from "./convergenceConfig";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "./transport/sseTransport";

export function bindCacheSyncToCoordinator(
  queryClient: QueryClient,
  coordinator: RealtimeCoordinator,
  getLeaderState: () => { isLeader: boolean; sseConnected: boolean; connectionState: ConnectionState }
): () => void {
  const unsub = coordinator.subscribePresentation((event: ApplicationUpdatedPayload) => {
    applyRealtimeEventToCache(queryClient, event);
  });

  const watchdog = setInterval(() => {
    const { isLeader, sseConnected } = getLeaderState();
    void runConvergenceHeal(queryClient, { isLeader, sseConnected });
  }, STALE_WATCHDOG_INTERVAL_MS);

  return () => {
    unsub();
    clearInterval(watchdog);
  };
}
