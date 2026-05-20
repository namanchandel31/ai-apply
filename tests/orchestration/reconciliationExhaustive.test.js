const { shouldApplyEvent } = require("../helpers/orchestrationMirror.cjs");

describe("reconciliation exhaustive cases", () => {
  const base = {
    applicationId: "app-1",
    terminal: false,
    pollable: true,
    lastVersion: 5,
    orchestrationEpoch: 2,
    lastUpdatedAt: "2026-05-20T12:00:00.000Z",
    prunedAt: null,
  };

  it("accepts duplicate packet", () => {
    const event = {
      applicationId: "app-1",
      version: 5,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    };
    expect(shouldApplyEvent(base, event).apply).toBe(true);
    expect(shouldApplyEvent(base, event).apply).toBe(true);
  });

  it("accepts equal version with newer updatedAt", () => {
    const r = shouldApplyEvent(base, {
      applicationId: "app-1",
      version: 5,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T13:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(r.apply).toBe(true);
  });

  it("rejects equal timestamp with older version", () => {
    const r = shouldApplyEvent(base, {
      applicationId: "app-1",
      version: 4,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:00:00.000Z",
      uiStatus: "processing",
      pollable: true,
      terminal: false,
    });
    expect(r.apply).toBe(false);
    expect(r.reason).toBe("stale_version");
  });

  it("accepts delayed terminal with newer version", () => {
    const r = shouldApplyEvent(base, {
      applicationId: "app-1",
      version: 6,
      orchestrationEpoch: 2,
      updatedAt: "2026-05-20T12:05:00.000Z",
      uiStatus: "sent",
      pollable: false,
      terminal: true,
    });
    expect(r.apply).toBe(true);
  });
});
