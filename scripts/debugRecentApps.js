#!/usr/bin/env node
require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const targetId = process.argv[2];
  if (targetId) {
    const jobs = await pool.query(
      `SELECT job_type, status, created_at FROM application_jobs WHERE application_id = $1 ORDER BY created_at`,
      [targetId]
    );
    console.log("\nJOBS for", targetId);
    console.table(jobs.rows);
    const events = await pool.query(
      `SELECT event_type, metadata, created_at FROM application_events WHERE application_id = $1 ORDER BY created_at`,
      [targetId]
    );
    console.log("EVENTS for", targetId);
    console.table(events.rows);
    await pool.end();
    return;
  }

  const { rows } = await pool.query(`
    SELECT a.id, a.application_status, a.source_platform, a.tracker_status_id,
           LEFT(a.email_subject, 40) AS email_subject,
           a.recipient_email, a.review_reason, a.created_at,
           jd.title, jd.company_name, jd.contact_email AS jd_contact
    FROM applications a
    JOIN job_descriptions jd ON jd.id = a.job_description_id
    ORDER BY a.created_at DESC
    LIMIT 5
  `);
  console.log("RECENT APPLICATIONS:");
  console.log(JSON.stringify(rows, null, 2));

  for (const r of rows) {
    const jobs = await pool.query(
      `SELECT job_type, status, last_error, created_at FROM application_jobs WHERE application_id = $1 ORDER BY created_at`,
      [r.id]
    );
    console.log("\nJOBS for", r.id);
    console.table(jobs.rows);

    const events = await pool.query(
      `SELECT event_type, metadata, created_at FROM application_events WHERE application_id = $1 ORDER BY created_at`,
      [r.id]
    );
    console.log("EVENTS for", r.id);
    console.table(events.rows);

    const user = await pool.query(`SELECT apply_mode FROM users WHERE id = (SELECT user_id FROM applications WHERE id = $1)`, [r.id]);
    console.log("User apply_mode:", user.rows[0]?.apply_mode);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
