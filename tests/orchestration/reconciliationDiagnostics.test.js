const fs = require("fs");
const path = require("path");

describe("reconciliation diagnostics", () => {
  it("maps reject reasons to log codes", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/realtime/reconciliation/reconciliationDiagnostics.ts"),
      "utf8"
    );
    expect(src).not.toContain("EVENT_APPLIED");
    expect(src).not.toContain("console.debug");
    expect(src).toContain("EVENT_REJECTED_STALE");
    expect(src).toContain("EVENT_REJECTED_EPOCH");
    expect(src).toContain("EVENT_REJECTED_TERMINAL");
  });

  it("coordinator uses reconciliation health for self-heal", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/realtime/realtimeCoordinator.ts"),
      "utf8"
    );
    expect(src).toContain("ReconciliationHealth");
    expect(src).toContain("registry.invalidate");
    expect(src).toContain("scheduleHydrate");
  });
});
