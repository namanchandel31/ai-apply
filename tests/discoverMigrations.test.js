const fs = require("fs");
const os = require("os");
const path = require("path");
const { discoverMigrations } = require("../scripts/lib/discoverMigrations");

describe("discoverMigrations", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-apply-mig-"));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("returns MISSING_DIR when directory does not exist", () => {
    const missing = path.join(tempRoot, "does-not-exist");
    const result = discoverMigrations(missing);

    expect(result).toEqual({
      ok: false,
      code: "MISSING_DIR",
      migrationsDir: path.resolve(missing),
    });
  });

  it("returns EMPTY when directory has no .sql files", () => {
    const emptyDir = path.join(tempRoot, "empty");
    fs.mkdirSync(emptyDir);
    fs.writeFileSync(path.join(emptyDir, "readme.txt"), "noop");

    const result = discoverMigrations(emptyDir);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("EMPTY");
  });

  it("returns sorted .sql files on success", () => {
    const migDir = path.join(tempRoot, "migrations");
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, "002_b.sql"), "SELECT 2;");
    fs.writeFileSync(path.join(migDir, "001_a.sql"), "SELECT 1;");

    const result = discoverMigrations(migDir);

    expect(result.ok).toBe(true);
    expect(result.migrations).toEqual(["001_a.sql", "002_b.sql"]);
    expect(result.migrationsDir).toBe(path.resolve(migDir));
  });
});
