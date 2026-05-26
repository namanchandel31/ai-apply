import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeCoordinator } from "./realtimeCoordinator";
import { runConvergenceHeal } from "./cache/cacheSyncApi";
import { createRealtimeCacheUpdateBatcher } from "./cache/realtimeCacheUpdateBatcher";
import { STALE_WATCHDOG_INTERVAL_MS } from "./convergenceConfig";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "./transport/sseTransport";

export function bindCacheSyncToCoordinator(
  queryClient: QueryClient,
  coordinator: RealtimeCoordinator,
  getLeaderState: () => { isLeader: boolean; sseConnected: boolean; connectionState: ConnectionState }
): () => void {
  const batcher = createRealtimeCacheUpdateBatcher(queryClient);
  const unsub = coordinator.subscribePresentation((event: ApplicationUpdatedPayload) => {
    batcher.enqueue(event);
  });

  const watchdog = setInterval(() => {
    const { isLeader, sseConnected } = getLeaderState();
    void runConvergenceHeal(queryClient, { isLeader, sseConnected });
  }, STALE_WATCHDOG_INTERVAL_MS);

  return () => {
    batcher.flushNow();
    batcher.destroy();
    unsub();
    clearInterval(watchdog);
  };
}
