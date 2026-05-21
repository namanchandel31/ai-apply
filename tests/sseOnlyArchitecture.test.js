const fs = require("fs");
const path = require("path");
const {
  appendReplayEvent,
  resetReplayBufferForTests,
} = require("../src/realtime/sseReplayBuffer");

describe("SSE-only architecture", () => {
  it("queue config defaults WORKER_MODE to separate", () => {
    jest.resetModules();
    delete process.env.WORKER_MODE;
    const queue = require("../src/config/queue.config");
    expect(queue.WORKER_MODE).toBe("separate");
    expect(queue.shouldRunInlineWorkers()).toBe(false);
  });

  it("WORKER_MODE=inline enables dev inline workers", () => {
    jest.resetModules();
    process.env.WORKER_MODE = "inline";
    process.env.NODE_ENV = "development";
    const queue = require("../src/config/queue.config");
    expect(queue.shouldRunInlineWorkers()).toBe(true);
    delete process.env.WORKER_MODE;
  });

  it("defines reconnect tier thresholds", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/services/realtime/reconnectRecoveryConfig.ts"),
      "utf8"
    );
    expect(src).toContain("RECOVERY_TIER1_MAX_MS = 60_000");
    expect(src).toContain("TIER2_MAX_AFFECTED_APPS = 50");
    expect(src).toContain("EVENT_BATCH_FLUSH_MS = 75");
  });

  it("documents eventId vs version in shouldApplyRealtimeEvent", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/services/realtime/reconciliation/shouldApplyRealtimeEvent.ts"),
      "utf8"
    );
    expect(src).toContain("eventId is transport-only");
    expect(src).toContain("stale_version");
  });

  it("RealtimeTransportManager is outside React", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/services/realtime/RealtimeTransportManager.ts"),
      "utf8"
    );
    expect(src).toContain("getRealtimeTransportManager");
    const provider = fs.readFileSync(
      path.join(__dirname, "../client/src/contexts/RealtimeProvider.tsx"),
      "utf8"
    );
    expect(provider).toContain("useSyncExternalStore");
    expect(provider).not.toContain("createSseTransport");
  });

  it("ApplicationTable does not use status poll hook", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/components/ApplicationTable.tsx"),
      "utf8"
    );
    expect(src).not.toContain("useApplicationStatusPoll");
  });

  it("broadcast uses state_patch not raw event", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/services/orchestration/orchestrationBroadcast.ts"),
      "utf8"
    );
    expect(src).toContain('"state_patch"');
    expect(src).not.toContain('"event"');
  });

  it("sse replay buffer assigns monotonic eventIds in memory mode", async () => {
    resetReplayBufferForTests();
    const a = await appendReplayEvent("u1", { applicationId: "a1", status: "queued" });
    const b = await appendReplayEvent("u1", { applicationId: "a1", status: "processing" });
    expect(a.eventId).toBeTruthy();
    expect(b.eventId).toBeTruthy();
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("realtimeCacheSession avoids reconnect invalidateQueries", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../client/src/services/realtime/realtimeCacheSession.ts"),
      "utf8"
    );
    expect(src).not.toContain("invalidateQueries");
    expect(src).not.toContain("scheduleListInvalidationFromApi");
  });
});
