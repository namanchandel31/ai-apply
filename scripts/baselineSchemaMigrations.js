#!/usr/bin/env node
/**
 * Mark all discovered .sql migrations as applied WITHOUT executing them.
 * Use once when the database schema already matches migrations but schema_migrations is empty.
 *
 *   node scripts/baselineSchemaMigrations.js
 *   MIGRATIONS_DIR=... node scripts/baselineSchemaMigrations.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { discoverMigrations } = require("./lib/discoverMigrations");
const {
  ensureSchemaMigrationsTable,
  migrationChecksum,
} = require("./lib/migrationLedger");

const defaultMigrationsDir = path.join(__dirname, "..", "src", "migrations");

async function main() {
  const migrationsDir = process.env.MIGRATIONS_DIR || defaultMigrationsDir;
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const discovery = discoverMigrations(migrationsDir);
  if (!discovery.ok || discovery.migrations.length === 0) {
    console.error("No migrations found");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    await ensureSchemaMigrationsTable(client);
    for (const name of discovery.migrations) {
      const sql = fs.readFileSync(path.join(discovery.migrationsDir, name), "utf8");
      const checksum = migrationChecksum(sql);
      await client.query(
        `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum`,
        [name, checksum]
      );
      console.log(`baseline: ${name}`);
    }
    console.log(`Done. Baselines ${discovery.migrations.length} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
