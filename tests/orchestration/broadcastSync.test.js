const fs = require("fs");
const path = require("path");

describe("orchestration broadcast", () => {
  it("defines cross-tab message types", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/orchestration/orchestrationBroadcast.ts"),
      "utf8"
    );
    expect(src).toContain('"revive"');
    expect(src).toContain('"terminal"');
    expect(src).toContain('"invalidate"');
    expect(src).toContain('"event"');
    expect(src).toContain("ORCHESTRATION_CHANNEL");
  });

  it("coordinator handles broadcast messages", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/realtime/realtimeCoordinator.ts"),
      "utf8"
    );
    expect(src).toContain("createOrchestrationBroadcast");
    expect(src).toContain('case "revive"');
    expect(src).toContain("createTabLeader");
    expect(src).toContain("connectTransport");
  });
});
