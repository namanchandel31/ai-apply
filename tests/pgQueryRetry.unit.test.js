const { executeWithPgRetry: retry } = require("../src/db/pgQueryRetry");
const { resetInfraLogDedupeForTests } = require("../src/utils/pgErrors");

jest.mock("../src/utils/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe("executeWithPgRetry", () => {
  beforeEach(() => {
    require("../src/db/pgRetryCircuit").resetCircuitForTests();
    resetInfraLogDedupeForTests();
  });

  it("retries transient pool-level errors", async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 2) {
          const err = new Error("read ECONNRESET");
          err.code = "ECONNRESET";
          throw err;
        }
        return "ok";
      },
      { inTransaction: false, queryName: "test" }
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does not retry inside active transaction", async () => {
    let calls = 0;
    const err = new Error("connection terminated unexpectedly");
    await expect(
      retry(
        async () => {
          calls += 1;
          throw err;
        },
        { inTransaction: true, queryName: "txn_test" }
      )
    ).rejects.toThrow("connection terminated unexpectedly");
    expect(calls).toBe(1);
  });

  it("does not retry constraint violations", async () => {
    let calls = 0;
    const err = new Error("duplicate key");
    err.code = "23505";
    await expect(
      retry(
        async () => {
          calls += 1;
          throw err;
        },
        { inTransaction: false }
      )
    ).rejects.toThrow("duplicate key");
    expect(calls).toBe(1);
  });
});
