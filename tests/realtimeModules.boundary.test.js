const fs = require("fs");
const path = require("path");

describe("realtime module boundaries", () => {
  it("keeps RealtimeProvider thin coordinator", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/contexts/RealtimeProvider.tsx"),
      "utf8"
    );
    const lines = src.split("\n").length;
    expect(lines).toBeLessThan(120);
    expect(src).toContain("createRealtimeCoordinator");
    expect(src).not.toContain("parseSseChunk");
  });

  it("isolates transport, reconciliation, and channel router modules", () => {
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/transport/sseTransport.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/reconciliation/shouldApplyEvent.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/realtime/events/channelRouter.ts"))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, "../client/src/services/orchestration/orchestrationRegistry.ts"))).toBe(true);
  });
});
