import { APPLICATION_MAX_POLL_ATTEMPTS } from "@/constants/polling";

const TERMINAL_UI_STATUSES = new Set(["sent", "failed", "cancelled", "needs_review"]);

export type PollableApplication = {
  terminal?: boolean;
  pollable?: boolean;
  uiStatus?: string;
  status?: string;
};

function isTerminalStatus(app: PollableApplication): boolean {
  const ui = (app.uiStatus ?? app.status ?? "").toLowerCase();
  return TERMINAL_UI_STATUSES.has(ui);
}

/**
 * Whether the client should keep polling this application.
 * Primary: backend pollable / terminal flags. Hardened with status strings.
 */
export function shouldPoll(
  app: PollableApplication,
  attempts: number,
  maxAttempts: number = APPLICATION_MAX_POLL_ATTEMPTS
): boolean {
  if (app.terminal === true) return false;
  if (app.pollable === false) return false;
  if (isTerminalStatus(app)) return false;
  if (attempts >= maxAttempts) return false;

  if (app.pollable === undefined && app.terminal === undefined) {
    const ui = app.uiStatus ?? app.status ?? "";
    if (TERMINAL_UI_STATUSES.has(ui)) return false;
  }

  return true;
}
