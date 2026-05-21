const fs = require("fs");
const path = require("path");

describe("realtime module boundaries", () => {
  it("keeps RealtimeProvider thin coordinator", () => {
    const providerSrc = fs.readFileSync(
      path.join(__dirname, "../client/src/contexts/RealtimeProvider.tsx"),
      "utf8"
    );
    const sessionSrc = fs.readFileSync(
      path.join(__dirname, "../client/src/services/realtime/realtimeSession.ts"),
      "utf8"
    );
    const lines = providerSrc.split("\n").length;
    expect(lines).toBeLessThan(160);
    expect(providerSrc).toContain("useSyncExternalStore");
    expect(sessionSrc).toContain("createRealtimeCoordinator");
    expect(providerSrc).not.toContain("parseSseChunk");
  });

  it("isolates transport, reconciliation, and channel router modules", () => {
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/transport/sseTransport.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/reconciliation/shouldApplyRealtimeEvent.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/cache/cacheSyncApi.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../src/realtime/postCommitPublishQueue.js"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/events/channelRouter.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/orchestration/orchestrationRegistry.ts"))).toBe(true);
  });
});
