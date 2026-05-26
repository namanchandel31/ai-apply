import type { QueryClient } from "@tanstack/react-query";
import {
  applyPollStatusToCache,
  getStaleApplicationIds,
} from "./applicationCacheSync";
import { hydrateApplicationStatuses } from "./partialHydrationScheduler";
import { assertLeaderOnly } from "../leaderGuards";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { MAX_STALE_CONVERGENCE_MS } from "../convergenceConfig";

export {
  applyRealtimeEventToCache,
  applyRealtimeEventsToCache,
  applyPollStatusToCache,
} from "./applicationCacheSync";

export type RunConvergenceHealOptions = {
  isLeader: boolean;
  sseConnected: boolean;
  fetchStatus?: (applicationId: string) => void;
};

export async function runConvergenceHeal(
  queryClient: QueryClient,
  options: RunConvergenceHealOptions
): Promise<void> {
  if (!assertLeaderOnly(options.isLeader, "heal")) return;

  const now = Date.now();
  const staleIds = getStaleApplicationIds(now, MAX_STALE_CONVERGENCE_MS);
  if (!staleIds.length) return;

  logDebug(
    "CONVERGENCE_HEAL_TRIGGERED",
    { count: staleIds.length, stage: "status_fetch_batch", component: "cache" },
    "cache"
  );

  try {
    const healed = await hydrateApplicationStatuses(queryClient, staleIds);
    for (const applicationId of staleIds.slice(0, healed)) {
      options.fetchStatus?.(applicationId);
    }
  } catch {
    // watchdog will retry on next interval
  }
}

export function resetCacheSyncApiForTests() {
  /* no-op — kept for test compatibility */
}
