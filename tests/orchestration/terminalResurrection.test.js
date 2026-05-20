const { shouldApplyEvent } = require("../helpers/orchestrationMirror.cjs");

describe("terminal resurrection guard", () => {
  it("blocks passive reactivation without epoch bump", () => {
    const registry = {
      applicationId: "app-1",
      terminal: true,
      pollable: false,
      lastVersion: 8,
      orchestrationEpoch: 2,
      lastUpdatedAt: "2026-05-20T12:00:00.000Z",
      prunedAt: Date.now(),
    };

    const result = shouldApplyEvent(registry, {
      applicationId: "app-1",
      version: 9,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:01:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(false);
    expect(result.reason).toBe("terminal_resurrection");
  });

  it("allows reactivation when epoch bumps", () => {
    const registry = {
      applicationId: "app-1",
      terminal: true,
      pollable: false,
      lastVersion: 8,
      orchestrationEpoch: 2,
      lastUpdatedAt: "2026-05-20T12:00:00.000Z",
      prunedAt: Date.now(),
    };

    const result = shouldApplyEvent(registry, {
      applicationId: "app-1",
      version: 9,
      orchestrationEpoch: 3,
      updatedAt: "2026-05-20T12:01:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(true);
  });
});
