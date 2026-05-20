const { shouldApplyEvent, OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("retry epoch", () => {
  it("ignores packets from previous epoch after revive", () => {
    const registry = new OrchestrationRegistry();
    registry.applyAcceptedEvent({
      applicationId: "app-1",
      version: 10,
      orchestrationEpoch: 3,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "failed",
      terminal: true,
      pollable: false,
    });

    registry.revive("app-1", 4);

    const stale = shouldApplyEvent(registry.get("app-1"), {
      applicationId: "app-1",
      version: 11,
      orchestrationEpoch: 3,
      updatedAt: "2026-05-20T12:01:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(stale.apply).toBe(false);
    expect(stale.reason).toBe("stale_epoch");
  });
});
