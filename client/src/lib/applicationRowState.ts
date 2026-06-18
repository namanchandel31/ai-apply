import type { ApplicationRecord } from "@/lib/api";

const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying", "draft"]);

export function isApplicationRowProcessing(app: ApplicationRecord): boolean {
  if (app.terminal) return false;
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  if (!ACTIVE_UI.has(ui)) return false;
  if (ui === "draft" && app.pollable === false) return false;
  return true;
}

export function isApplicationRowFailed(app: ApplicationRecord): boolean {
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  if (ui === "failed") return true;
  return Boolean(app.canRetry && (app.lastError || app.reviewReason));
}

export function applicationRowErrorMessage(app: ApplicationRecord): string | null {
  const msg = app.lastError || app.reviewReason;
  if (!msg || !String(msg).trim()) return null;
  if (!isApplicationRowFailed(app)) return null;
  return String(msg).trim();
}

export function buildPendingApplicationRow(
  partial: Partial<ApplicationRecord> & { id: string }
): ApplicationRecord {
  const now = new Date().toISOString();
  const { id, ...rest } = partial;
  return {
    status: "draft",
    uiStatus: "processing",
    terminal: false,
    executionTerminal: false,
    pollable: true,
    canRetry: false,
    canContinue: false,
    canSend: false,
    createdAt: now,
    updatedAt: now,
    jdEnrichment: "pending",
    role: null,
    company: null,
    matchScore: null,
    id,
    ...rest,
  };
}
