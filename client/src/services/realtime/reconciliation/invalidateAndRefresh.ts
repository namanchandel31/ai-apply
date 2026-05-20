import type { OrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";

const rejectWindowMs = 10_000;
const rejectThreshold = 3;

type RejectTracker = { count: number; firstAt: number };

export class ReconciliationHealth {
  private readonly rejects = new Map<string, RejectTracker>();

  recordReject(applicationId: string): boolean {
    const now = Date.now();
    const existing = this.rejects.get(applicationId);
    if (!existing || now - existing.firstAt > rejectWindowMs) {
      this.rejects.set(applicationId, { count: 1, firstAt: now });
      return false;
    }
    existing.count += 1;
    return existing.count >= rejectThreshold;
  }

  checkImpossibleApply(
    registry: OrchestrationRegistry,
    applicationId: string,
    event: ApplicationUpdatedPayload
  ): boolean {
    const state = registry.get(applicationId);
    if (!state) return false;
    const v = event.version ?? 0;
    const e = event.orchestrationEpoch ?? 0;
    if (v < state.lastVersion || e < state.orchestrationEpoch) {
      return true;
    }
    return false;
  }

  clear(applicationId: string): void {
    this.rejects.delete(applicationId);
  }
}
