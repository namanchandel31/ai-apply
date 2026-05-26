const { EventEmitter } = require("events");
const {
  buildRealtimePayload,
  EVENT_APPLICATION_UPDATED,
} = require("../src/services/applicationRealtimePublisher");

describe("applicationRealtimePublisher", () => {
  it("builds compact application.updated payload", () => {
    const payload = buildRealtimePayload(
      "app-1",
      "user-1",
      {
        status: "draft",
        uiStatus: "processing",
        terminal: false,
        executionTerminal: false,
        pollable: true,
        canRetry: false,
        canContinue: false,
        reviewReason: null,
        updatedAt: "2026-05-20T12:00:00.000Z",
        role: "Software Engineer",
        company: "Acme Corp",
        matchScore: 82,
        terminal: false,
      },
      { version: 1, epoch: 0 }
    );

    expect(payload.type).toBe(EVENT_APPLICATION_UPDATED);
    expect(payload.applicationId).toBe("app-1");
    expect(payload.userId).toBe("user-1");
    expect(payload.uiStatus).toBe("processing");
    expect(payload.terminal).toBe(false);
    expect(payload.role).toBe("Software Engineer");
    expect(payload.company).toBe("Acme Corp");
    expect(payload.matchScore).toBe(82);
    expect(payload.updatedAt).toBe("2026-05-20T12:00:00.000Z");
    expect(payload.jdEnrichment).toBe("complete");
    expect(payload).not.toHaveProperty("emailBody");
  });
});

describe("realtimeBus", () => {
  it("is an EventEmitter singleton with raised max listeners", () => {
    const { realtimeBus } = require("../src/events/realtimeBus");
    expect(realtimeBus).toBeInstanceOf(EventEmitter);
    expect(realtimeBus.getMaxListeners()).toBeGreaterThanOrEqual(50);
  });
});
