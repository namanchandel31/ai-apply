const crypto = require("crypto");

/** Advisory lock key — arbitrary int; must not collide with app usage. */
const MIGRATION_RUN_LOCK_KEY = 928_374_651;

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function migrationChecksum(sql) {
  return crypto.createHash("sha256").update(sql, "utf8").digest("hex");
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(ENSURE_TABLE_SQL);
}

async function isMigrationApplied(client, name) {
  const { rows } = await client.query(
    `SELECT 1 AS ok FROM schema_migrations WHERE name = $1`,
    [name]
  );
  return rows.length > 0;
}

/**
 * Run one migration file in a single transaction and record it.
 */
async function applyMigrationInTransaction(client, name, sql, checksum) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)`,
      [name, checksum]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

module.exports = {
  MIGRATION_RUN_LOCK_KEY,
  ENSURE_TABLE_SQL,
  migrationChecksum,
  ensureSchemaMigrationsTable,
  isMigrationApplied,
  applyMigrationInTransaction,
};
