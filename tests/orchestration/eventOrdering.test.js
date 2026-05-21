const { shouldApplyEvent } = require("../helpers/orchestrationMirror.cjs");
const {
  shouldApplyOrchestrationEvent,
  shouldApplyDisplayEventTieBreak,
} = require("../helpers/reconciliationMirror.cjs");

describe("event ordering", () => {
  const baseRegistry = {
    applicationId: "app-1",
    terminal: false,
    pollable: true,
    lastVersion: 5,
    orchestrationEpoch: 2,
    lastUpdatedAt: "2026-05-20T12:00:00.000Z",
    prunedAt: null,
  };

  it("rejects stale version", () => {
    const result = shouldApplyEvent(baseRegistry, {
      applicationId: "app-1",
      version: 4,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:01:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(false);
    expect(result.reason).toBe("stale_version");
  });

  it("rejects stale epoch", () => {
    const result = shouldApplyEvent(baseRegistry, {
      applicationId: "app-1",
      version: 6,
      orchestrationEpoch: 1,
      updatedAt: "2026-05-20T12:01:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(false);
    expect(result.reason).toBe("stale_epoch");
  });

  it("rejects stale updatedAt tie-break via combined shim only", () => {
    const result = shouldApplyEvent(baseRegistry, {
      applicationId: "app-1",
      version: 5,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T11:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(false);
    expect(result.reason).toBe("stale_updated_at");
  });

  it("orchestration ingress allows same-version older updatedAt (display gated in cache)", () => {
    expect(
      shouldApplyOrchestrationEvent(baseRegistry, {
        applicationId: "app-1",
        version: 5,
        orchestrationEpoch: 2,
        updatedAt: "2026-05-20T11:00:00.000Z",
        uiStatus: "processing",
      }).apply
    ).toBe(true);
    expect(
      shouldApplyDisplayEventTieBreak(baseRegistry, {
        version: 5,
        orchestrationEpoch: 2,
        updatedAt: "2026-05-20T11:00:00.000Z",
      }).reason
    ).toBe("stale_updated_at");
  });

  it("accepts newer version", () => {
    const result = shouldApplyEvent(baseRegistry, {
      applicationId: "app-1",
      version: 6,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:02:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(result.apply).toBe(true);
  });
});
