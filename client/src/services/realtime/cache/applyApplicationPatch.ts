import type { ApplicationRecord } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";

export function patchApplicationRow(
  app: ApplicationRecord,
  event: ApplicationUpdatedPayload
): ApplicationRecord {
  return {
    ...app,
    status: event.status,
    uiStatus: event.uiStatus,
    terminal: event.terminal,
    executionTerminal: event.executionTerminal,
    pollable: event.pollable,
    canRetry: event.canRetry,
    canContinue: event.canContinue,
    canSend: event.canSend,
    reviewReason: event.reviewReason ?? undefined,
    trackerStatusId: event.trackerStatusId ?? app.trackerStatusId,
  };
}
