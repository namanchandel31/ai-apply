const { OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("terminal hard stop", () => {
  it("getPollableIds empty after terminal prune", () => {
    const registry = new OrchestrationRegistry();
    registry.applyAcceptedEvent({
      applicationId: "app-1",
      version: 3,
      orchestrationEpoch: 0,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "sent",
      pollable: false,
      terminal: true,
    });

    expect(registry.getPollableIds(60)).toEqual([]);
    const state = registry.get("app-1");
    expect(state.terminal).toBe(true);
    expect(state.prunedAt).not.toBeNull();
    expect(state.pollAttempts).toBe(0);
  });
});
