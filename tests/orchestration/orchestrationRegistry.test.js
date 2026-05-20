const { OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("orchestration registry", () => {
  it("stable pollable ids under rapid transitions", () => {
    const registry = new OrchestrationRegistry();
    registry.applyAcceptedEvent({
      applicationId: "a",
      version: 1,
      orchestrationEpoch: 0,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "queued",
      pollable: true,
      terminal: false,
    });
    registry.applyAcceptedEvent({
      applicationId: "b",
      version: 1,
      orchestrationEpoch: 0,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    registry.markTerminal("a");

    expect(registry.getPollableIds(60)).toEqual(["b"]);
  });
});
