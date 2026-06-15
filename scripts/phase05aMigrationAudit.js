#!/usr/bin/env node
/** Phase 0.5a read-only migration audit */
require("dotenv").config();
const { Pool } = require("pg");
const path = require("path");
const { discoverMigrations } = require("./lib/discoverMigrations");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    const discovery = discoverMigrations(path.join(__dirname, "..", "src", "migrations"));
    const local = discovery.ok ? discovery.migrations : [];
    const ledgerRes = await client.query(
      "SELECT name, applied_at FROM schema_migrations ORDER BY name"
    );
    const ledgerNames = new Set(ledgerRes.rows.map((r) => r.name));
    const pending = local.filter((f) => !ledgerNames.has(f));

    const cols = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
       AND (
         (table_name = 'users' AND column_name = 'apply_mode')
         OR column_name IN (
           'source_platform', 'source_url', 'source_email', 'discovered_at',
           'source_company_name', 'source_recruiter_name', 'source_post_id'
         )
       )
       ORDER BY table_name, column_name`
    );

    const det = await client.query(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'extension_detection_config'`
    );

    console.log(
      JSON.stringify(
        {
          localCount: local.length,
          ledgerCount: ledgerRes.rows.length,
          latestLocal: local[local.length - 1] ?? null,
          pending,
          proposedColumnsInSchema: cols.rows,
          extensionDetectionConfigTable: det.rows.length > 0,
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
