const {
  resetPublishStateForTests,
  invalidateBundleCache,
  publishApplicationUpdate,
} = require("../../src/realtime/publishApplicationUpdate");

jest.mock("../../src/db", () => ({ pool: {} }));

jest.mock("../../src/services/applicationStatusQueryService", () => ({
  getApplicationStatusBundle: jest.fn(),
  getApplicationStatusSnapshot: jest.fn(),
}));

jest.mock("../../src/realtime/realtimeDispatch", () => ({
  fanOutRealtimePayload: jest.fn(),
}));

jest.mock("../../src/realtime/sseReplayBuffer", () => ({
  appendReplayEvent: jest.fn(async (_userId, payload) => ({
    eventId: "evt-1",
    payload: { ...payload, eventId: "evt-1" },
  })),
}));

jest.mock("../../src/realtime/publishDedupeRegistry", () => ({
  shouldEmitPublish: jest.fn(() => ({ allow: true })),
  recordEmitted: jest.fn(),
  publishKey: jest.fn(() => "key"),
}));

const { getApplicationStatusBundle } = require("../../src/services/applicationStatusQueryService");
const { fanOutRealtimePayload } = require("../../src/realtime/realtimeDispatch");

describe("publishApplicationUpdate bundle cache", () => {
  const applicationId = "app-cache-test";
  const userId = "user-1";

  beforeEach(() => {
    resetPublishStateForTests();
    jest.clearAllMocks();
    require("../../src/db").pool.query = jest.fn().mockResolvedValue({
      rows: [
        {
          application_status: "generated",
          orchestration_version: 3,
          orchestration_epoch: 0,
          updated_at: new Date().toISOString(),
        },
      ],
    });
  });

  function bundleFor(uiStatus) {
    return {
      row: {
        id: applicationId,
        application_status: "generated",
        orchestration_version: 3,
        orchestration_epoch: 0,
        updated_at: new Date().toISOString(),
        send_queue_status: uiStatus === "queued_sending" ? "waiting" : null,
        role: "Engineer",
        company_name: "Acme",
      },
      jobs: {},
    };
  }

  it("re-fetches bundle for queued_sending after generated was cached", async () => {
    getApplicationStatusBundle
      .mockResolvedValueOnce(bundleFor("generated"))
      .mockResolvedValueOnce(bundleFor("queued_sending"));

    await publishApplicationUpdate(applicationId, userId, { publishSource: "post_commit" });
    await publishApplicationUpdate(applicationId, userId, {
      publishSource: "intelligent_send_queued",
      bypassBundleCache: true,
    });

    expect(getApplicationStatusBundle).toHaveBeenCalledTimes(2);
    expect(fanOutRealtimePayload).toHaveBeenCalledTimes(2);
    const lastPayload = fanOutRealtimePayload.mock.calls[1][0];
    expect(lastPayload.uiStatus).toBe("queued_sending");
  });

  it("invalidateBundleCache forces fresh bundle on next publish", async () => {
    getApplicationStatusBundle
      .mockResolvedValueOnce(bundleFor("generated"))
      .mockResolvedValueOnce(bundleFor("queued_sending"));

    await publishApplicationUpdate(applicationId, userId, { publishSource: "post_commit" });
    invalidateBundleCache(applicationId);
    await publishApplicationUpdate(applicationId, userId, {
      publishSource: "intelligent_send_queued",
    });

    expect(getApplicationStatusBundle).toHaveBeenCalledTimes(2);
    const lastPayload = fanOutRealtimePayload.mock.calls[1][0];
    expect(lastPayload.uiStatus).toBe("queued_sending");
  });
});
