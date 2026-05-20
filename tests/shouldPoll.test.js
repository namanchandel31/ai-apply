/**
 * Mirrors client/src/lib/shouldPoll.ts for Jest (Node does not load TS directly).
 */
const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);

function isTerminalStatus(app) {
  const ui = (app.uiStatus ?? app.status ?? "").toLowerCase();
  return TERMINAL_UI.has(ui);
}

function shouldPoll(app, attempts, maxAttempts = 60) {
  if (app.terminal === true) return false;
  if (app.pollable === false) return false;
  if (isTerminalStatus(app)) return false;
  if (attempts >= maxAttempts) return false;
  if (app.pollable === undefined && app.terminal === undefined) {
    const ui = app.uiStatus ?? app.status ?? "";
    if (TERMINAL_UI.has(ui)) return false;
  }
  return true;
}

describe("shouldPoll", () => {
  it("stops when terminal is true", () => {
    expect(shouldPoll({ terminal: true, pollable: false }, 0)).toBe(false);
  });

  it("stops when pollable is false", () => {
    expect(shouldPoll({ terminal: false, pollable: false }, 0)).toBe(false);
  });

  it("stops at max attempts", () => {
    expect(shouldPoll({ terminal: false, pollable: true }, 60, 60)).toBe(false);
  });

  it("continues when pollable and not terminal", () => {
    expect(shouldPoll({ terminal: false, pollable: true }, 1)).toBe(true);
  });

  it("needs_review stops via pollable false", () => {
    expect(
      shouldPoll({ terminal: false, pollable: false, uiStatus: "needs_review" }, 0)
    ).toBe(false);
  });

  it("terminal true wins over pollable true", () => {
    expect(shouldPoll({ terminal: true, pollable: true }, 0)).toBe(false);
  });

  it("stops for sent status even when pollable is true", () => {
    expect(shouldPoll({ terminal: false, pollable: true, uiStatus: "sent" }, 0)).toBe(
      false
    );
  });

  it("stops for failed status string", () => {
    expect(shouldPoll({ status: "failed", pollable: true }, 0)).toBe(false);
  });

  it("stops for cancelled status string", () => {
    expect(shouldPoll({ uiStatus: "cancelled", pollable: true }, 0)).toBe(false);
  });
});
