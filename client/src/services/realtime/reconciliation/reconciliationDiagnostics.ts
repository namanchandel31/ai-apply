import { logDebug, logWarnDeduped } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";
import type { RejectReason } from "./shouldApplyEvent";

function staleByFromReason(reason: RejectReason | undefined): string {
  if (reason === "stale_epoch") return "epoch";
  if (reason === "stale_updated_at") return "updatedAt";
  return "version";
}

function rejectEventCode(reason: RejectReason | undefined): string {
  if (reason === "stale_epoch") return "EVENT_REJECTED_EPOCH";
  if (reason === "terminal_resurrection" || reason === "pruned") {
    return "EVENT_REJECTED_TERMINAL";
  }
  return "EVENT_REJECTED_STALE";
}

const repeatTrack = new Map<string, number>();
const REPEATED_THRESHOLD = 3;

export function logEventForReason(
  applicationId: string,
  reason: RejectReason | undefined,
  applied: boolean
): void {
  if (applied) return;

  const code = rejectEventCode(reason);
  const staleBy = staleByFromReason(reason);
  const key = `${applicationId}:${staleBy}`;
  const count = (repeatTrack.get(key) || 0) + 1;
  repeatTrack.set(key, count);

  metrics.increment("orchestration.reconcile.reject", { reason: reason || "unknown" });

  const meta = {
    applicationId,
    reason,
    staleBy,
    regressionType: count >= REPEATED_THRESHOLD ? "repeated_stale" : "harmless_replay",
    replayDetected: true,
    repeatedCount: count,
    component: "reconciliation" as const,
  };

  if (count < REPEATED_THRESHOLD) {
    if (isDebugEnabled("reconciliation")) {
      logDebug(code, meta, "reconciliation");
    }
    return;
  }

  logWarnDeduped("VERSION_REGRESSION_DETECTED", key, {
    ...meta,
    event: code,
  });
}

export function resetReconciliationDiagnosticsForTests() {
  repeatTrack.clear();
}
