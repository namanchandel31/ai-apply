import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";

export function normalizeApplicationEvent(
  raw: Record<string, unknown>,
  eventName: string
): ApplicationUpdatedPayload | null {
  const type = (raw.type as string) || (eventName === "application.updated" ? "application.updated" : "");
  if (type !== "application.updated") return null;

  const applicationId = raw.applicationId as string;
  if (!applicationId) return null;

  return {
    type: "application.updated",
    channel: (raw.channel as string) || "applications",
    applicationId,
    userId: raw.userId as string | undefined,
    version: Number(raw.version ?? 0),
    orchestrationEpoch: Number(raw.orchestrationEpoch ?? 0),
    updatedAt: String(raw.updatedAt ?? ""),
    status: String(raw.status ?? ""),
    uiStatus: String(raw.uiStatus ?? raw.status ?? ""),
    terminal: Boolean(raw.terminal),
    executionTerminal: Boolean(raw.executionTerminal ?? raw.terminal),
    pollable: Boolean(raw.pollable),
    canRetry: Boolean(raw.canRetry),
    canContinue: Boolean(raw.canContinue),
    reviewReason: (raw.reviewReason as string | null) ?? null,
    role: (raw.role as string | null) ?? null,
    company: (raw.company as string | null) ?? null,
    jdEnrichment: raw.jdEnrichment as ApplicationUpdatedPayload["jdEnrichment"],
  };
}
