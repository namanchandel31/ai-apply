const {
  _bumpOrchestrationEpoch,
  _incrementOrchestrationVersion,
} = require("../src/services/orchestrationVersion");

describe("transition orchestration bump helpers", () => {
  const mockClient = {
    queries: [],
    async query(sql, params) {
      this.queries.push({ sql, params });
      if (sql.includes("SELECT orchestration_version")) {
        return { rows: [{ orchestration_version: 5, orchestration_epoch: 2 }] };
      }
      if (sql.includes("orchestration_epoch = orchestration_epoch + 1")) {
        return {
          rows: [{ orchestration_version: 6, orchestration_epoch: 3, updated_at: new Date() }],
        };
      }
      if (sql.includes("orchestration_version = orchestration_version + 1")) {
        return {
          rows: [{ orchestration_version: 6, orchestration_epoch: 2, updated_at: new Date() }],
        };
      }
      return { rows: [] };
    },
  };

  it("bumpOrchestrationEpoch increments both version and epoch", async () => {
    const row = await _bumpOrchestrationEpoch(mockClient, "app-1");
    expect(Number(row.orchestration_version)).toBe(6);
    expect(Number(row.orchestration_epoch)).toBe(3);
  });

  it("incrementOrchestrationVersion increments version only", async () => {
    const row = await _incrementOrchestrationVersion(mockClient, "app-1");
    expect(Number(row.orchestration_version)).toBe(6);
    expect(Number(row.orchestration_epoch)).toBe(2);
  });
});
