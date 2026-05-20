#!/usr/bin/env node
/**
 * Reproduce bind / prepared-statement issues through the instrumentation layer.
 * Usage: DEBUG_QUERY_SHAPE=1 node scripts/reproPreparedStatement.js
 */
require("dotenv").config();
const { pool, instrumentedQuery, closePoolIfAny } = require("../src/db");
const { STATUS_BUNDLE_SQL } = require("../src/models/applicationModel");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const { rows } = await pool.query(
    `SELECT id, user_id FROM applications ORDER BY created_at DESC LIMIT 1`
  );
  if (!rows[0]) {
    console.error("No applications to test");
    process.exit(1);
  }
  const { id, user_id } = rows[0];

  console.log("1) instrumentedQuery status_bundle (2 params)...");
  await instrumentedQuery(pool, "status_bundle", STATUS_BUNDLE_SQL, [id, user_id], pool);

  console.log("2) instrumentedQuery one-param query...");
  await instrumentedQuery(
    pool,
    "status_snapshot",
    `SELECT id FROM applications WHERE id = $1 AND user_id = $2`,
    [id, user_id],
    pool
  );

  console.log("3) pool.query via wrapper (2 params)...");
  await pool.query(`SELECT id FROM applications WHERE id = $1 AND user_id = $2`, [id, user_id]);

  console.log("OK — no bind mismatch");
  await closePoolIfAny();
}

main().catch(async (err) => {
  console.error("FAILED:", err.message);
  await closePoolIfAny();
  process.exit(1);
});
