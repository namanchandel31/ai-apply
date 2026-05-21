const fs = require("fs");
const path = require("path");

describe("realtime terminal guard", () => {
  it("logs REALTIME_TERMINAL_SKIP for already-terminal publish", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/realtime/publishApplicationUpdate.js"),
      "utf8"
    );
    expect(src).toContain("REALTIME_TERMINAL_SKIP");
    expect(src).toMatch(/alreadyTerminal[\s\S]*!options\.forceRevive[\s\S]*!options\.enteringTerminal/);
    expect(src).toContain("getApplicationStatusSnapshot");
    expect(src).not.toMatch(/incrementOrchestrationVersion,\s*\n\};/);
  });

  it("buildRealtimePayload includes version and epoch", () => {
    const { buildRealtimePayload } = require("../src/services/applicationRealtimePublisher");
    const payload = buildRealtimePayload(
      "app-1",
      "user-1",
      {
        status: "sent",
        uiStatus: "sent",
        terminal: true,
        executionTerminal: true,
        pollable: false,
        canRetry: false,
        canContinue: false,
        reviewReason: null,
        updatedAt: "2026-05-20T12:00:00.000Z",
      },
      { version: 7, epoch: 2 }
    );
    expect(payload.version).toBe(7);
    expect(payload.orchestrationEpoch).toBe(2);
    expect(payload.channel).toBe("applications");
  });
});
