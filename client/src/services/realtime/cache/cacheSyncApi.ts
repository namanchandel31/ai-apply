import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationStatusPayload } from "@/lib/api";
import { api } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import {
  applyRealtimeEventToCache,
  applyPollStatusToCache,
  getStaleApplicationIds,
  markRowConverged,
} from "./applicationCacheSync";
import { assertLeaderOnly } from "../leaderGuards";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { MAX_STALE_CONVERGENCE_MS } from "../convergenceConfig";

export { applyRealtimeEventToCache, applyPollStatusToCache };

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

  for (const applicationId of staleIds) {
    logDebug(
      "CONVERGENCE_HEAL_TRIGGERED",
      { applicationId, stage: "status_fetch", component: "cache" },
      "cache"
    );

    try {
      const res = await api.getApplicationStatus(applicationId);
      const data = res.data as ApplicationUpdatedPayload & { applicationId?: string };
      applyRealtimeEventToCache(queryClient, { ...data, applicationId });
      markRowConverged(applicationId);
      options.fetchStatus?.(applicationId);
    } catch {
      // skip — next watchdog cycle may retry
    }
  }
}

export function resetCacheSyncApiForTests() {
  /* no-op — kept for test compatibility */
}
