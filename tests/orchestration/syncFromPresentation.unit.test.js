const { OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("syncFromPresentation", () => {
  it("does not advance lastUpdatedAt from list rows", () => {
    const registry = new OrchestrationRegistry();
    registry.states.set("app-1", {
      applicationId: "app-1",
      terminal: false,
      pollable: true,
      lastVersion: 10,
      orchestrationEpoch: 2,
      lastUpdatedAt: "2026-05-20T10:00:00.000Z",
      prunedAt: null,
      sseSubscribed: true,
      pollAttempts: 0,
      pollErrors: 0,
      backoffUntil: null,
    });

    registry.syncFromPresentation([
      {
        id: "app-1",
        terminal: false,
        pollable: true,
        uiStatus: "processing",
        status: "draft",
        updatedAt: "2026-05-20T15:00:00.000Z",
        createdAt: "2026-05-20T08:00:00.000Z",
      },
    ]);

    expect(registry.get("app-1").lastUpdatedAt).toBe("2026-05-20T10:00:00.000Z");
    expect(registry.get("app-1").lastVersion).toBe(10);
  });
});
