#!/usr/bin/env node
/**
 * Sample pg_stat_activity and pg_locks for applications / application_jobs contention.
 * Usage: node scripts/checkDbContention.js
 */
require("dotenv").config();
const { pool, getPoolMetrics } = require("../src/db");

async function main() {
  console.log("Pool metrics:", getPoolMetrics(pool));

  const activity = await pool.query(`
    SELECT pid, state, wait_event_type, wait_event, query_start,
           left(query, 120) AS query_preview
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
    ORDER BY query_start NULLS LAST
    LIMIT 20
  `);
  console.log("\n--- pg_stat_activity (sample) ---");
  console.table(activity.rows);

  const locks = await pool.query(`
    SELECT l.locktype, l.mode, l.granted, c.relname, a.query_start,
           left(a.query, 100) AS query_preview
    FROM pg_locks l
    LEFT JOIN pg_class c ON c.oid = l.relation
    LEFT JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE c.relname IN ('applications', 'application_jobs', 'application_events')
       OR l.locktype = 'transactionid'
    ORDER BY l.granted, a.query_start NULLS LAST
    LIMIT 30
  `);
  console.log("\n--- pg_locks (applications / jobs) ---");
  console.table(locks.rows);

  const blocking = await pool.query(`
    SELECT blocked.pid AS blocked_pid,
           blocking.pid AS blocking_pid,
           left(blocked.query, 80) AS blocked_query,
           left(blocking.query, 80) AS blocking_query
    FROM pg_stat_activity blocked
    JOIN pg_locks blocked_locks ON blocked_locks.pid = blocked.pid AND NOT blocked_locks.granted
    JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
      AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
      AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
      AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
      AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
      AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
      AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
      AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
      AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
      AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
      AND blocking_locks.pid <> blocked_locks.pid
    JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
    WHERE NOT blocking_locks.granted
    LIMIT 10
  `);
  console.log("\n--- blocked queries ---");
  if (blocking.rows.length === 0) {
    console.log("(none)");
  } else {
    console.table(blocking.rows);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
