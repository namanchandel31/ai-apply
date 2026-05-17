const fs = require("fs");
const path = require("path");

/**
 * Discover sorted .sql migration files in a directory.
 * @param {string} migrationsDir
 * @returns {{ ok: true, migrations: string[] } | { ok: false, code: 'MISSING_DIR' | 'EMPTY', migrationsDir: string }}
 */
function discoverMigrations(migrationsDir) {
  const resolved = path.resolve(migrationsDir);

  if (!fs.existsSync(resolved)) {
    return { ok: false, code: "MISSING_DIR", migrationsDir: resolved };
  }

  const migrations = fs
    .readdirSync(resolved)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (migrations.length === 0) {
    return { ok: false, code: "EMPTY", migrationsDir: resolved };
  }

  return { ok: true, migrations, migrationsDir: resolved };
}

module.exports = { discoverMigrations };
