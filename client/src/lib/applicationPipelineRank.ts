import type { ApplicationRecord } from "@/lib/api";

/** Monotonic send-pipeline ordering for same-version realtime/list merges. */
const UI_PIPELINE_RANK: Record<string, number> = {
  draft: 0,
  queued: 1,
  processing: 2,
  retrying: 2,
  generated: 3,
  needs_review: 3,
  queued_sending: 4,
  sending: 5,
  sent: 6,
  failed: 6,
  cancelled: 6,
};

export function uiPipelineRank(ui: string | null | undefined): number {
  if (!ui) return -1;
  return UI_PIPELINE_RANK[ui.toLowerCase()] ?? -1;
}

export function pickAdvancedPipelineUi<T extends { uiStatus?: string | null; status?: string | null }>(
  existing: T,
  incoming: T
): T {
  const existingUi = existing.uiStatus || existing.status || "";
  const incomingUi = incoming.uiStatus || incoming.status || "";
  const existingRank = uiPipelineRank(existingUi);
  const incomingRank = uiPipelineRank(incomingUi);
  if (existingRank === incomingRank) return incoming;
  return incomingRank > existingRank ? incoming : existing;
}

/** Keep farther-along pipeline status when a list refetch returns stale rows. */
export function preservePipelineStatusFromExisting(
  incoming: ApplicationRecord,
  existing: ApplicationRecord | undefined
): ApplicationRecord {
  if (!existing) return incoming;
  const advanced = pickAdvancedPipelineUi(existing, incoming);
  if (advanced === incoming) return incoming;
  return {
    ...incoming,
    status: existing.status ?? incoming.status,
    uiStatus: existing.uiStatus ?? incoming.uiStatus,
    terminal: existing.terminal ?? incoming.terminal,
    executionTerminal: existing.executionTerminal ?? incoming.executionTerminal,
    pollable: existing.pollable ?? incoming.pollable,
    canRetry: existing.canRetry ?? incoming.canRetry,
    canContinue: existing.canContinue ?? incoming.canContinue,
    canSend: existing.canSend ?? incoming.canSend,
    canSendNow: existing.canSendNow ?? incoming.canSendNow,
    estimatedSendAt: existing.estimatedSendAt ?? incoming.estimatedSendAt,
  };
}
