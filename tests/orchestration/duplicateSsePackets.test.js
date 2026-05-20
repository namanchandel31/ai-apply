const { OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("duplicate SSE packets", () => {
  it("applies duplicate safely without corrupting version", () => {
    const registry = new OrchestrationRegistry();
    const event = {
      applicationId: "app-1",
      version: 4,
      orchestrationEpoch: 1,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    };

    registry.applyAcceptedEvent(event);
    registry.applyAcceptedEvent(event);

    const state = registry.get("app-1");
    expect(state.lastVersion).toBe(4);
    expect(state.orchestrationEpoch).toBe(1);
    expect(state.pollable).toBe(true);
  });
});
