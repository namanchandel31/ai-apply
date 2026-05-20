#!/usr/bin/env node
/**
 * Run EXPLAIN (ANALYZE, BUFFERS) for status hot-path queries.
 * Usage: node scripts/explainStatusQueries.js [applicationId] [userId]
 * Requires DATABASE_URL in environment.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db");
const { STATUS_BUNDLE_SQL } = require("../src/models/applicationModel");

const QUERIES = [
  {
    name: "status_snapshot",
    sql: `SELECT id, application_status, review_reason, retry_count, last_error,
            created_at, updated_at, sent_at, completed_at
     FROM applications
     WHERE id = $1 AND user_id = $2`,
  },
  {
    name: "status_job_ai_process",
    sql: `SELECT * FROM application_jobs
     WHERE application_id = $1 AND job_type = 'ai_process'
     ORDER BY created_at DESC
     LIMIT 1`,
  },
  {
    name: "status_job_send_email",
    sql: `SELECT * FROM application_jobs
     WHERE application_id = $1 AND job_type = 'send_email'
     ORDER BY created_at DESC
     LIMIT 1`,
  },
  {
    name: "status_jobs_distinct_on",
    sql: `SELECT DISTINCT ON (job_type) *
     FROM application_jobs
     WHERE application_id = $1
     ORDER BY job_type, created_at DESC`,
  },
  {
    name: "status_bundle",
    sql: STATUS_BUNDLE_SQL,
  },
];

async function resolveSampleIds(applicationId, userId) {
  if (applicationId && userId) {
    return { applicationId, userId };
  }
  const { rows } = await pool.query(
    `SELECT id, user_id FROM applications ORDER BY created_at DESC LIMIT 1`
  );
  if (!rows[0]) {
    throw new Error("No applications in database — pass applicationId and userId");
  }
  return { applicationId: rows[0].id, userId: rows[0].user_id };
}

function flagPlanIssues(planText) {
  const flags = [];
  if (/Seq Scan on applications/i.test(planText)) flags.push("SEQ_SCAN applications");
  if (/Seq Scan on application_jobs/i.test(planText)) flags.push("SEQ_SCAN application_jobs");
  if (/Sort\s+\(/i.test(planText) && !/Index Scan/i.test(planText)) {
    flags.push("SORT (verify index usage)");
  }
  return flags;
}

async function explainQuery(name, sql, params) {
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`;
  const { rows } = await pool.query(explainSql, params);
  const planText = rows.map((r) => r["QUERY PLAN"]).join("\n");
  const flags = flagPlanIssues(planText);
  return { name, planText, flags };
}

async function main() {
  const applicationIdArg = process.argv[2];
  const userIdArg = process.argv[3];
  const { applicationId, userId } = await resolveSampleIds(applicationIdArg, userIdArg);

  const sections = [
    `# Status query plans`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Sample applicationId: \`${applicationId}\``,
    `Sample userId: \`${userId}\``,
    ``,
  ];

  for (const q of QUERIES) {
    const params =
      q.name === "status_jobs_distinct_on" ? [applicationId] : [applicationId, userId];
    console.log(`\n=== ${q.name} ===\n`);
    const result = await explainQuery(q.name, q.sql, params);
    console.log(result.planText);
    if (result.flags.length) {
      console.log("FLAGS:", result.flags.join(", "));
    }
    sections.push(`## ${q.name}`);
    sections.push("");
    sections.push("```text");
    sections.push(result.planText);
    sections.push("```");
    if (result.flags.length) {
      sections.push("");
      sections.push(`**Flags:** ${result.flags.join(", ")}`);
    }
    sections.push("");
  }

  const outPath = path.join(__dirname, "../docs/status-query-plans.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sections.join("\n"), "utf8");
  console.log(`\nWrote ${outPath}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
