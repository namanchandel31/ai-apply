const { migrationChecksum, applyMigrationInTransaction } = require("../scripts/lib/migrationLedger");

describe("migrationLedger", () => {
  it("migrationChecksum is stable for same content", () => {
    const a = migrationChecksum("SELECT 1;");
    const b = migrationChecksum("SELECT 1;");
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  it("migrationChecksum differs for different content", () => {
    expect(migrationChecksum("A")).not.toBe(migrationChecksum("B"));
  });

  it("applyMigrationInTransaction runs BEGIN, sql, INSERT, COMMIT on success", async () => {
    const calls = [];
    const client = {
      query: jest.fn(async (sql) => {
        calls.push(sql.trim().split(/\s+/)[0] || sql.slice(0, 20));
        return { rows: [] };
      }),
    };
    await applyMigrationInTransaction(client, "001_x.sql", "SELECT 1;", "abc");
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(calls[0]).toBe("BEGIN");
    expect(calls[1]).toBe("SELECT");
    expect(calls[2]).toMatch(/INSERT/);
    expect(calls[3]).toBe("COMMIT");
  });

  it("applyMigrationInTransaction ROLLBACK on failure", async () => {
    const client = {
      query: jest.fn(async (sql) => {
        if (String(sql).trim() === "SELECT 1;") {
          throw new Error("boom");
        }
        return { rows: [] };
      }),
    };
    await expect(
      applyMigrationInTransaction(client, "001_x.sql", "SELECT 1;", "abc")
    ).rejects.toThrow("boom");
    const texts = client.query.mock.calls.map((c) => String(c[0]).trim());
    expect(texts).toContain("BEGIN");
    expect(texts).toContain("ROLLBACK");
    expect(texts).not.toContain("COMMIT");
  });
});
