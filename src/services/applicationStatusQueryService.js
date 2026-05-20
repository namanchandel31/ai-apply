const { pool, instrumentedQuery } = require("../db");

const STATUS_BUNDLE_SQL = `
SELECT
  a.id,
  a.application_status,
  a.review_reason,
  a.retry_count,
  a.last_error,
  a.created_at,
  a.updated_at,
  a.sent_at,
  a.completed_at,
  pj.id AS process_job_id,
  pj.status AS process_job_status,
  pj.created_at AS process_job_created_at,
  pj.updated_at AS process_job_updated_at,
  pj.last_error AS process_job_last_error,
  pj.retry_count AS process_job_retry_count,
  sj.id AS send_job_id,
  sj.status AS send_job_status,
  sj.created_at AS send_job_created_at,
  sj.updated_at AS send_job_updated_at,
  sj.last_error AS send_job_last_error,
  sj.retry_count AS send_job_retry_count
FROM applications a
LEFT JOIN LATERAL (
  SELECT id, status, created_at, updated_at, last_error, retry_count
  FROM application_jobs
  WHERE application_id = a.id AND job_type = 'ai_process'
  ORDER BY created_at DESC
  LIMIT 1
) pj ON true
LEFT JOIN LATERAL (
  SELECT id, status, created_at, updated_at, last_error, retry_count
  FROM application_jobs
  WHERE application_id = a.id AND job_type = 'send_email'
  ORDER BY created_at DESC
  LIMIT 1
) sj ON true
WHERE a.id = $1 AND a.user_id = $2
`;

function mapJobFromBundle(row, prefix) {
  const id = row[`${prefix}_id`];
  if (!id) return null;
  return {
    id,
    application_id: row.id,
    job_type: prefix === "process_job" ? "ai_process" : "send_email",
    status: row[`${prefix}_status`],
    created_at: row[`${prefix}_created_at`],
    updated_at: row[`${prefix}_updated_at`],
    last_error: row[`${prefix}_last_error`],
    retry_count: row[`${prefix}_retry_count`],
  };
}

function mapBundleRow(row) {
  if (!row) return null;
  const appRow = {
    id: row.id,
    application_status: row.application_status,
    review_reason: row.review_reason,
    retry_count: row.retry_count,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sent_at: row.sent_at,
    completed_at: row.completed_at,
  };
  return {
    row: appRow,
    bundleRow: row,
    jobs: {
      processJob: mapJobFromBundle(row, "process_job"),
      sendJob: mapJobFromBundle(row, "send_job"),
    },
  };
}

async function getApplicationStatusBundle(applicationId, userId, client = null) {
  const queryClient = client || pool;
  const { rows } = await instrumentedQuery(
    queryClient,
    "status_bundle",
    STATUS_BUNDLE_SQL,
    [applicationId, userId],
    pool
  );
  return mapBundleRow(rows[0] ?? null);
}

async function getApplicationStatusSnapshot(applicationId, userId, client = null) {
  const queryClient = client || pool;
  const { rows } = await instrumentedQuery(
    queryClient,
    "status_snapshot",
    `SELECT id, application_status, review_reason, retry_count, last_error,
            created_at, updated_at, sent_at, completed_at
     FROM applications
     WHERE id = $1 AND user_id = $2`,
    [applicationId, userId],
    pool
  );
  return rows[0] ?? null;
}

module.exports = {
  STATUS_BUNDLE_SQL,
  mapBundleRow,
  getApplicationStatusBundle,
  getApplicationStatusSnapshot,
};
