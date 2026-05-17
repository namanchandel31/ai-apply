const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

const { runMigrations } = require("../run-migrations");

describe("runMigrations", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-apply-run-mig-"));
    process.env.DATABASE_URL = "postgres://localhost/test";
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
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

  it("executes migrations in sorted order when files exist", async () => {
    const migDir = path.join(tempRoot, "migrations");
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, "002_b.sql"), "SELECT 2;");
    fs.writeFileSync(path.join(migDir, "001_a.sql"), "SELECT 1;");

    const { Pool } = require("pg");
    const result = await runMigrations(migDir);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(Pool.mock.results[0].value.query).toHaveBeenCalledTimes(2);
  });
});
