const { getActiveOrchestrationForUser } = require("../../src/services/orchestrationSnapshotService");

jest.mock("../../src/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require("../../src/db");

describe("orchestration hydration endpoint service", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it("returns version epoch terminal pollable per application", async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          id: "app-1",
          application_status: "draft",
          review_reason: null,
          retry_count: 0,
          orchestration_version: 8,
          orchestration_epoch: 2,
          updated_at: new Date("2026-05-20T12:00:00.000Z"),
        },
      ],
    });

    const states = await getActiveOrchestrationForUser("user-1");
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({
      applicationId: "app-1",
      version: 8,
      orchestrationEpoch: 2,
      terminal: false,
    });
    expect(typeof states[0].pollable).toBe("boolean");
    expect(states[0].updatedAt).toContain("2026-05-20");
  });
});
