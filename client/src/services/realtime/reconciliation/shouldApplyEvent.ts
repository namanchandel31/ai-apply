import type {
  ApplicationUpdatedPayload,
  OrchestrationState,
} from "@/services/orchestration/orchestrationRegistry";
import { isTerminalUiStatus } from "@/services/orchestration/orchestrationRegistry";

const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying"]);

export type RejectReason =
  | "stale_version"
  | "stale_epoch"
  | "stale_updated_at"
  | "terminal_resurrection"
  | "pruned";

export function shouldApplyEvent(
  registry: OrchestrationState | undefined,
  event: ApplicationUpdatedPayload
): { apply: boolean; reason?: RejectReason } {
  const eventVersion = event.version ?? 0;
  const eventEpoch = event.orchestrationEpoch ?? 0;

  if (!registry) {
    return { apply: true };
  }

  if (eventVersion < registry.lastVersion) {
    return { apply: false, reason: "stale_version" };
  }
  if (eventEpoch < registry.orchestrationEpoch) {
    return { apply: false, reason: "stale_epoch" };
  }

  if (
    event.updatedAt &&
    registry.lastUpdatedAt &&
    eventVersion === registry.lastVersion &&
    eventEpoch === registry.orchestrationEpoch &&
    event.updatedAt < registry.lastUpdatedAt
  ) {
    return { apply: false, reason: "stale_updated_at" };
  }

  if (registry?.terminal) {
    const passiveReactivation =
      event.pollable === true ||
      ACTIVE_UI.has(event.uiStatus) ||
      (!event.terminal && !isTerminalUiStatus(event.uiStatus));
    if (passiveReactivation && eventEpoch <= registry.orchestrationEpoch) {
      return { apply: false, reason: "terminal_resurrection" };
    }
  }

  if (registry?.prunedAt != null && eventEpoch <= registry.orchestrationEpoch) {
    return { apply: false, reason: "pruned" };
  }

  return { apply: true };
}
