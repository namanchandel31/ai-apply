import type { ApplicationRecord } from "@/lib/api";

/** States that keep the row in the active orchestration/poll set. */
const ACTIVE_UI = new Set(["processing", "sending", "queued", "queued_sending", "retrying", "draft"]);

/** Early pipeline — show tile spinner and JD parsing placeholders. */
const TILE_LOADER_UI = new Set(["processing", "queued", "retrying", "draft"]);

/** Only the status column shimmers while waiting in the intelligent send queue. */
const STATUS_SHIMMER_UI = new Set(["queued_sending"]);

/** JD fields may still be filling in during these states. */
const JD_PARSING_UI = new Set(["processing", "queued", "retrying", "draft"]);

export function isApplicationRowProcessing(app: ApplicationRecord): boolean {
  if (app.terminal) return false;
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  if (!ACTIVE_UI.has(ui)) return false;
  if (ui === "draft" && app.pollable === false) return false;
  return true;
}

export function isApplicationRowTileLoading(app: ApplicationRecord): boolean {
  if (app.terminal) return false;
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  return TILE_LOADER_UI.has(ui);
}

export function isApplicationStatusShimmering(app: ApplicationRecord): boolean {
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  return STATUS_SHIMMER_UI.has(ui);
}

export function isApplicationJdParsing(app: ApplicationRecord): boolean {
  if (app.jdEnrichment === "complete") return false;
  const ui = (app.uiStatus || app.status || "").toLowerCase();
  return JD_PARSING_UI.has(ui);
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
