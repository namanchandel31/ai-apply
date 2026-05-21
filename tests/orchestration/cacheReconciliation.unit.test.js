const {
  shouldApplyOrchestrationEvent,
  shouldApplyDisplayEventTieBreak,
  shouldApplyOrchestrationRowPatch,
  mergeCachePatch,
  mergePartialWithListRow,
} = require("../helpers/reconciliationMirror.cjs");
const { shouldApplyEvent, OrchestrationRegistry } = require("../helpers/orchestrationMirror.cjs");

describe("orchestration ingress gate", () => {
  const baseRegistry = {
    applicationId: "app-1",
    terminal: false,
    pollable: true,
    lastVersion: 5,
    orchestrationEpoch: 2,
    lastUpdatedAt: "2026-05-20T12:00:00.000Z",
    prunedAt: null,
  };

  it("rejects stale version at ingress", () => {
    expect(
      shouldApplyOrchestrationEvent(baseRegistry, {
        applicationId: "app-1",
        version: 4,
        orchestrationEpoch: 2,
        uiStatus: "processing",
      }).apply
    ).toBe(false);
  });

  it("does not use stale_updated_at in orchestration gate", () => {
    const r = shouldApplyOrchestrationEvent(baseRegistry, {
      applicationId: "app-1",
      version: 5,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T11:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(r.apply).toBe(true);
    expect(
      shouldApplyDisplayEventTieBreak(baseRegistry, {
        applicationId: "app-1",
        version: 5,
        orchestrationEpoch: 2,
        updatedAt: "2026-05-20T11:00:00.000Z",
      }).reason
    ).toBe("stale_updated_at");
  });

  it("accepts terminal transition at ingress even when prunedAt will be set after apply", () => {
    const registry = new OrchestrationRegistry();
    registry.states.set("app-1", {
      applicationId: "app-1",
      terminal: false,
      pollable: true,
      lastVersion: 8,
      orchestrationEpoch: 2,
      lastUpdatedAt: "2026-05-20T12:00:00.000Z",
      prunedAt: null,
    });

    const event = {
      applicationId: "app-1",
      version: 9,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:05:00.000Z",
      status: "sent",
      uiStatus: "sent",
      terminal: true,
      pollable: false,
    };

    expect(shouldApplyOrchestrationEvent(registry.get("app-1"), event).apply).toBe(true);
    registry.applyAcceptedEvent(event);
    expect(registry.get("app-1").prunedAt).not.toBeNull();

    expect(shouldApplyOrchestrationEvent(registry.get("app-1"), event).apply).toBe(false);
    expect(shouldApplyOrchestrationEvent(registry.get("app-1"), event).reason).toBe("pruned");
  });
});

describe("cache orchestration row patch", () => {
  it("patches status/uiStatus for terminal sent event (no post-coordinator pruned gate)", () => {
    const existing = {
      id: "app-1",
      status: "generated",
      uiStatus: "generated",
      updatedAt: "2026-05-20T12:00:00.000Z",
    };
    const event = {
      applicationId: "app-1",
      version: 9,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:05:00.000Z",
      status: "sent",
      uiStatus: "sent",
      terminal: true,
      pollable: false,
    };
    const merged = mergeCachePatch(existing, event, 2);
    expect(merged.uiStatus).toBe("sent");
    expect(merged.status).toBe("sent");
    expect(merged.terminal).toBe(true);
  });

  it("patches forward transition processing to generated", () => {
    const existing = {
      id: "app-1",
      status: "draft",
      uiStatus: "processing",
      updatedAt: "2026-05-20T12:00:00.000Z",
    };
    const event = {
      applicationId: "app-1",
      version: 7,
      orchestrationEpoch: 1,
      updatedAt: "2026-05-20T12:03:00.000Z",
      status: "generated",
      uiStatus: "generated",
      terminal: false,
      pollable: true,
    };
    const merged = mergeCachePatch(existing, event, 1);
    expect(merged.uiStatus).toBe("generated");
    expect(merged.status).toBe("generated");
  });

  it("applies orch patch when display updatedAt is stale", () => {
    const existing = {
      id: "app-1",
      status: "draft",
      uiStatus: "draft",
      role: "New Role",
      updatedAt: "2026-05-20T13:00:00.000Z",
    };
    const event = {
      applicationId: "app-1",
      version: 6,
      orchestrationEpoch: 1,
      updatedAt: "2026-05-20T12:00:00.000Z",
      status: "generated",
      uiStatus: "generated",
      role: "Old Role",
      company: "Old Co",
    };
    const merged = mergeCachePatch(existing, event, 1);
    expect(merged.uiStatus).toBe("generated");
    expect(merged.role).toBeUndefined();
    expect(merged.company).toBeUndefined();
  });

  it("blocks terminal downgrade without epoch bump", () => {
    const existing = {
      id: "app-1",
      status: "sent",
      uiStatus: "sent",
      updatedAt: "2026-05-20T12:00:00.000Z",
    };
    const event = {
      applicationId: "app-1",
      version: 10,
      orchestrationEpoch: 2,
      status: "draft",
      uiStatus: "processing",
      terminal: false,
      pollable: true,
    };
    expect(shouldApplyOrchestrationRowPatch(existing, event, 2).apply).toBe(false);
    expect(mergeCachePatch(existing, event, 2)).toEqual({});
  });
});

describe("partial hydration merge", () => {
  it("merges authoritative status from list row when promoting partial", () => {
    const partial = {
      id: "app-1",
      status: "draft",
      uiStatus: "draft",
      _partial: true,
      role: "Parsing JD…",
    };
    const authoritative = {
      id: "app-1",
      status: "generated",
      uiStatus: "generated",
      role: "Engineer",
      company: "Acme",
    };
    const merged = mergePartialWithListRow(partial, authoritative);
    expect(merged._partial).toBeUndefined();
    expect(merged.uiStatus).toBe("generated");
    expect(merged.company).toBe("Acme");
  });
});

describe("syncFromPresentation clock", () => {
  it("legacy combined gate still rejects stale_updated_at via shim", () => {
    const baseRegistry = {
      lastVersion: 5,
      orchestrationEpoch: 2,
      lastUpdatedAt: "2026-05-20T12:00:00.000Z",
      terminal: false,
      prunedAt: null,
    };
    expect(
      shouldApplyEvent(baseRegistry, {
        version: 5,
        orchestrationEpoch: 2,
        updatedAt: "2026-05-20T11:00:00.000Z",
        uiStatus: "processing",
      }).reason
    ).toBe("stale_updated_at");
  });
});
