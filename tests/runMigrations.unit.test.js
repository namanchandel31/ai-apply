const fs = require("fs");
const os = require("os");
const path = require("path");

/** Set by beforeEach; mock Pool.connect resolves to this client. */
let mockTestClient;

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockImplementation(async () => mockTestClient),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

const { runMigrations, closePoolIfAny } = require("../run-migrations");

describe("runMigrations (ledger)", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-apply-run-mig-"));
    process.env.DATABASE_URL = "postgres://localhost/test";
    const query = jest.fn().mockResolvedValue({ rows: [] });
    mockTestClient = { query, release: jest.fn() };
    const { Pool } = require("pg");
    Pool.mockClear();
    await closePoolIfAny();
  });

  afterEach(async () => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    await closePoolIfAny();
  });

  it("returns exitCode 1 when migrations directory is missing", async () => {
    const result = await runMigrations(path.join(tempRoot, "missing"));
    expect(result).toEqual({ success: false, exitCode: 1 });
  });

  it("returns exitCode 0 when directory is empty of sql files", async () => {
    const emptyDir = path.join(tempRoot, "empty");
    fs.mkdirSync(emptyDir);

    const result = await runMigrations(emptyDir);
    expect(result).toEqual({ success: true, exitCode: 0, skipped: true });
  });

  it("applies pending migrations and records ledger in transaction", async () => {
    const migDir = path.join(tempRoot, "migrations");
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, "001_a.sql"), "SELECT 1;");
    fs.writeFileSync(path.join(migDir, "002_b.sql"), "SELECT 2;");

    const result = await runMigrations(migDir);

    expect(result.success).toBe(true);
    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.count).toBe(2);
    expect(mockTestClient.release).toHaveBeenCalled();

    const sqls = mockTestClient.query.mock.calls.map((c) =>
      String(c[0]).replace(/\s+/g, " ").trim()
    );
    expect(sqls.some((s) => s.includes("CREATE TABLE IF NOT EXISTS schema_migrations"))).toBe(
      true
    );
    expect(sqls.some((s) => s.includes("pg_advisory_lock"))).toBe(true);
    expect(sqls.some((s) => s.includes("pg_advisory_unlock"))).toBe(true);
    expect(sqls.filter((s) => s === "BEGIN").length).toBe(2);
    expect(sqls.filter((s) => s === "COMMIT").length).toBe(2);
    expect(sqls.filter((s) => s.includes("INSERT INTO schema_migrations")).length).toBe(2);
  });

  it("skips migrations already in ledger", async () => {
    const migDir = path.join(tempRoot, "migrations");
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, "001_a.sql"), "SELECT 1;");

    mockTestClient.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM schema_migrations WHERE name")) {
        return { rows: [{ ok: 1 }] };
      }
      return { rows: [] };
    });

    const result = await runMigrations(migDir);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(
      mockTestClient.query.mock.calls.some((c) => String(c[0]).trim() === "BEGIN")
    ).toBe(false);
  });
});
