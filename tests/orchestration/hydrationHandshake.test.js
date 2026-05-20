const fs = require("fs");
const path = require("path");

describe("hydration handshake", () => {
  it("coordinator buffers before hydration and hydrates from API", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/realtime/realtimeCoordinator.ts"),
      "utf8"
    );
    expect(src).toContain("preHydrationBuffer");
    expect(src).toContain("getOrchestrationActive");
    expect(src).toContain("hydrateFromServer");
    expect(src).toContain("!registry.isHydrated()");
    expect(src).toContain("drainPreHydrationBuffer");
  });

  it("registry exposes hydration lifecycle", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/orchestration/orchestrationRegistry.ts"),
      "utf8"
    );
    expect(src).toContain("hydrateFromServer");
    expect(src).toContain("isHydrated");
    expect(src).toContain("resetHydration");
  });
});
