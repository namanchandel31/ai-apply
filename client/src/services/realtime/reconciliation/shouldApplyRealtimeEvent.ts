/**
 * Canonical ordering gate for realtime events.
 * Orchestration: version → epoch → terminal → pruned (coordinator ingress only).
 * Display: updatedAt monotonic tie-break (cache merge only).
 *
 * eventId is transport-only (Last-Event-ID / replay cursor). It must never override
 * version when deciding apply vs reject — even if eventId is newer with lower version.
 */
import type { ApplicationRecord } from "@/lib/api";
import type {
  ApplicationUpdatedPayload,
  OrchestrationState,
} from "@/services/orchestration/orchestrationRegistry";
import { isTerminalUiStatus } from "@/services/orchestration/orchestrationRegistry";

const ACTIVE_UI = new Set(["processing", "sending", "queued", "queued_sending", "retrying"]);

/** Later send-pipeline UI must not be downgraded by earlier pipeline SSE (same version). */
const SEND_PIPELINE_UI = new Set(["queued_sending", "sending"]);
const EARLIER_PIPELINE_UI = new Set(["generated", "processing", "queued", "draft"]);

export type RejectReason =
  | "stale_version"
  | "stale_epoch"
  | "stale_updated_at"
  | "terminal_resurrection"
  | "pruned"
  | "terminal_downgrade"
  | "empty_status";

export type RowRejectReason = "terminal_downgrade" | "empty_status";

/** Coordinator ingress: version/epoch/terminal/pruned only. */
export function shouldApplyOrchestrationEvent(
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

  if (registry.terminal) {
    const passiveReactivation =
      event.pollable === true ||
      ACTIVE_UI.has(event.uiStatus) ||
      (!event.terminal && !isTerminalUiStatus(event.uiStatus));
    if (passiveReactivation && eventEpoch <= registry.orchestrationEpoch) {
      return { apply: false, reason: "terminal_resurrection" };
    }
  }

  if (registry.prunedAt != null && eventEpoch <= registry.orchestrationEpoch) {
    return { apply: false, reason: "pruned" };
  }

  return { apply: true };
}

/** Display-only tie-break when version and epoch are equal (optional coordinator path). */
export function shouldApplyDisplayEventTieBreak(
  registry: OrchestrationState | undefined,
  event: ApplicationUpdatedPayload
): { apply: boolean; reason?: RejectReason } {
  if (!registry) return { apply: true };
  const eventVersion = event.version ?? 0;
  const eventEpoch = event.orchestrationEpoch ?? 0;
  if (
    event.updatedAt &&
    registry.lastUpdatedAt &&
    eventVersion === registry.lastVersion &&
    eventEpoch === registry.orchestrationEpoch &&
    event.updatedAt < registry.lastUpdatedAt
  ) {
    return { apply: false, reason: "stale_updated_at" };
  }
  return { apply: true };
}

/** @deprecated Use shouldApplyOrchestrationEvent at coordinator ingress. */
export function shouldApplyRealtimeEvent(
  registry: OrchestrationState | undefined,
  event: ApplicationUpdatedPayload
): { apply: boolean; reason?: RejectReason } {
  const orch = shouldApplyOrchestrationEvent(registry, event);
  if (!orch.apply) return orch;
  const display = shouldApplyDisplayEventTieBreak(registry, event);
  if (!display.apply) return display;
  return { apply: true };
}

export function shouldApplyDisplayPatch(
  existing: ApplicationRecord | undefined,
  incoming: Partial<ApplicationRecord>
): boolean {
  if (!existing?.updatedAt) return true;
  if (!incoming.updatedAt) return false;
  return incoming.updatedAt >= existing.updatedAt;
}

/** Cache row guard after coordinator accepted the event. */
export function shouldApplyOrchestrationRowPatch(
  existing: ApplicationRecord | undefined,
  event: ApplicationUpdatedPayload,
  registryEpoch = 0
): { apply: boolean; reason?: RowRejectReason } {
  const incomingUi = (event.uiStatus || event.status || "").trim();
  const incomingStatus = (event.status || "").trim();
  if (!incomingUi && !incomingStatus) {
    return { apply: false, reason: "empty_status" };
  }

  if (!existing) {
    return { apply: true };
  }

  const existingUi = existing.uiStatus || existing.status;
  const existingTerminal = isTerminalUiStatus(existingUi);
  const incomingTerminal = isTerminalUiStatus(incomingUi || incomingStatus);

  if (existingTerminal && !incomingTerminal) {
    const eventEpoch = event.orchestrationEpoch ?? 0;
    if (eventEpoch <= registryEpoch) {
      return { apply: false, reason: "terminal_downgrade" };
    }
  }

  if (
    SEND_PIPELINE_UI.has(existingUi) &&
    EARLIER_PIPELINE_UI.has(incomingUi || incomingStatus)
  ) {
    return { apply: false, reason: "terminal_downgrade" };
  }

  return { apply: true };
}

export function orchPatchFromEvent(
  event: ApplicationUpdatedPayload,
  existing?: ApplicationRecord,
  registryEpoch = 0
): Partial<ApplicationRecord> {
  const rowCheck = shouldApplyOrchestrationRowPatch(existing, event, registryEpoch);
  if (!rowCheck.apply) return {};

  const patch: Partial<ApplicationRecord> = {};
  const status = (event.status || "").trim();
  const uiStatus = (event.uiStatus || event.status || "").trim();

  if (status) patch.status = event.status;
  if (uiStatus) patch.uiStatus = event.uiStatus || event.status;
  if (event.terminal !== undefined) patch.terminal = event.terminal;
  if (event.executionTerminal !== undefined) patch.executionTerminal = event.executionTerminal;
  if (event.pollable !== undefined) patch.pollable = event.pollable;
  if (event.canRetry !== undefined) patch.canRetry = event.canRetry;
  if (event.canContinue !== undefined) patch.canContinue = event.canContinue;
  if (event.canSend !== undefined) patch.canSend = event.canSend;
  if (event.canSendNow !== undefined) patch.canSendNow = event.canSendNow;
  if (event.estimatedSendAt !== undefined) patch.estimatedSendAt = event.estimatedSendAt;
  if (event.reviewReason !== undefined) patch.reviewReason = event.reviewReason ?? undefined;
  if (event.updatedAt) patch.updatedAt = event.updatedAt;

  return patch;
}
