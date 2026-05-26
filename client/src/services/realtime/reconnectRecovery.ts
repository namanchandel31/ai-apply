import { api } from "@/lib/api";
import {
  canRunCatastrophicRecovery,
  isRealtimeDegraded,
  recordCatastrophicRecoveryAttempt,
} from "./CatastrophicRecoveryGuard";
import { assertLeaderOnly } from "./leaderGuards";
import {
  RECOVERY_TIER1_MAX_MS,
  RECOVERY_TIER2_MAX_MS,
  selectRecoveryTier,
  TIER2_FETCH_RATE_LIMIT_MS,
  TIER2_MAX_AFFECTED_APPS,
  TIER2_MAX_CONCURRENT_FETCHES,
  type RecoveryTier,
} from "./reconnectRecoveryConfig";
import { getLastEventId } from "./replay/lastEventIdStore";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { globalOrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";

export type RecoveryContext = {
  disconnectMs: number;
  replayCount: number;
  replayExpired: boolean;
  replayMiss: boolean;
  affectedApplicationIds: string[];
  isLeader: boolean;
};

export type RecoveryActions = {
  hydrateBootstrap: () => Promise<void>;
  applyStatusToRegistry: (applicationId: string, status: ApplicationUpdatedPayload) => void;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTier2TargetedHeal(
  applicationIds: string[],
  actions: RecoveryActions
): Promise<void> {
  const ids = applicationIds.slice(0, TIER2_MAX_AFFECTED_APPS);
  logDebug(
    "TIER2_RECOVERY_START",
    { affected: applicationIds.length, fetching: ids.length, escalated: applicationIds.length > ids.length },
    "reconciliation"
  );
  metrics.increment("orchestration.recovery.tier2_count");

  let idx = 0;
  const worker = async () => {
    while (idx < ids.length) {
      const id = ids[idx++];
      try {
        const res = await api.getApplicationStatus(id);
        if (res.notModified) continue;
        actions.applyStatusToRegistry(id, {
          ...res.data,
          applicationId: id,
          updatedAt: res.data.updatedAt ?? new Date().toISOString(),
        });
      } catch {
        // skip failed row — watchdog may retry
      }
      await sleep(TIER2_FETCH_RATE_LIMIT_MS);
    }
  };

  const workers = Array.from(
    { length: Math.min(TIER2_MAX_CONCURRENT_FETCHES, ids.length) },
    () => worker()
  );
  await Promise.all(workers);
}

export async function runReconnectRecovery(
  ctx: RecoveryContext,
  actions: RecoveryActions
): Promise<RecoveryTier> {
  if (!assertLeaderOnly(ctx.isLeader, "heal")) return 1;

  let tier = selectRecoveryTier(ctx.disconnectMs);
  const lastEventId = getLastEventId();

  if (ctx.replayExpired || ctx.replayMiss) {
    tier = 3;
    metrics.increment("orchestration.replay.tier3_replay_expired");
    logDebug("REPLAY_EXPIRED", { disconnectMs: ctx.disconnectMs }, "reconciliation");
  } else if (!lastEventId && ctx.disconnectMs >= RECOVERY_TIER1_MAX_MS) {
    tier = Math.max(tier, 2) as RecoveryTier;
  }

  if (ctx.affectedApplicationIds.length > TIER2_MAX_AFFECTED_APPS) {
    tier = 3;
    logDebug("TIER2_BOUND_EXCEEDED", { count: ctx.affectedApplicationIds.length }, "reconciliation");
    metrics.increment("orchestration.recovery.tier2_escalation_count");
  }

  if (tier === 1 && ctx.replayCount > 0) {
    logDebug(
      "RECOVERY_TIER_SELECTED",
      { tier: 1, disconnectMs: ctx.disconnectMs, lastEventId, replayCount: ctx.replayCount },
      "reconciliation"
    );
    logDebug(
      "REPLAY_COMPLETE",
      { replayCount: ctx.replayCount },
      "reconciliation"
    );
    return 1;
  }

  if (tier === 2 && ctx.disconnectMs < RECOVERY_TIER2_MAX_MS) {
    logDebug(
      "RECOVERY_TIER_SELECTED",
      { tier: 2, disconnectMs: ctx.disconnectMs, lastEventId, replayCount: ctx.replayCount },
      "reconciliation"
    );
    await runTier2TargetedHeal(ctx.affectedApplicationIds, actions);
    return 2;
  }

  tier = 3;
  logDebug(
    "CATASTROPHIC_RECOVERY_TRIGGERED",
    { reason: ctx.replayExpired ? "replay_expired" : "tier3", disconnectMs: ctx.disconnectMs },
    "reconciliation"
  );

  if (isRealtimeDegraded() || !canRunCatastrophicRecovery()) {
    logDebug("REALTIME_DEGRADED_MODE", { tier: 3 }, "reconciliation");
    return 3;
  }

  recordCatastrophicRecoveryAttempt();
  logDebug(
    "RECOVERY_TIER_SELECTED",
    { tier: 3, disconnectMs: ctx.disconnectMs, lastEventId, replayCount: ctx.replayCount },
    "reconciliation"
  );
  await actions.hydrateBootstrap();
  return 3;
}

const GAP_SCAN_MAX_POLL_ATTEMPTS = 9999;

export function getAffectedApplicationIdsForGap(): string[] {
  const registry = globalOrchestrationRegistry;
  if (!registry.isHydrated()) return [];
  return registry.getPollableIds(GAP_SCAN_MAX_POLL_ATTEMPTS);
}
