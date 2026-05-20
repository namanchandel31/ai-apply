/**
 * Append-only execution rows. status=failed means this attempt failed, not necessarily workflow-final.
 * See src/domain/applicationStatus/failureSemantics.js and docs/UI_STATUS_RESOLUTION.md.
 */
const { pool } = require("../db");

async function createJob(
  { applicationId, jobType, status = "queued", bullmqJobId = null },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO application_jobs (application_id, job_type, status, bullmq_job_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [applicationId, jobType, status, bullmqJobId]
  );
  return rows[0];
}

async function getJobById(jobId, client = pool) {
  const { rows } = await client.query(`SELECT * FROM application_jobs WHERE id = $1`, [jobId]);
  return rows[0] ?? null;
}

async function getLatestJobByType(applicationId, jobType, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM application_jobs
     WHERE application_id = $1 AND job_type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [applicationId, jobType]
  );
  return rows[0] ?? null;
}

async function getLatestJobsForApplication(applicationId, client = pool) {
  const processJob = await getLatestJobByType(applicationId, "ai_process", client);
  const sendJob = await getLatestJobByType(applicationId, "send_email", client);
  return { processJob, sendJob };
}

async function hasActiveJob(applicationId, jobType, client = pool) {
  const { rows } = await client.query(
    `SELECT 1 FROM application_jobs
     WHERE application_id = $1 AND job_type = $2
       AND status IN ('queued', 'processing', 'retrying')
     LIMIT 1`,
    [applicationId, jobType]
  );
  return rows.length > 0;
}

async function hasCompletedSendJob(applicationId, client = pool) {
  const { rows } = await client.query(
    `SELECT 1 FROM application_jobs
     WHERE application_id = $1 AND job_type = 'send_email' AND status = 'completed'
     LIMIT 1`,
    [applicationId]
  );
  return rows.length > 0;
}

/**
 * Latest recoverable stuck jobs only — ignores superseded executions.
 */
async function findRecoverableStuckProcessingJobs(olderThanMinutes = 15, client = pool) {
  const { rows } = await client.query(
    `SELECT j.*, a.application_status, a.review_reason, a.user_id, a.recipient_email, a.retry_count
     FROM application_jobs j
     INNER JOIN (
       SELECT application_id, job_type, MAX(created_at) AS max_created
       FROM application_jobs
       GROUP BY application_id, job_type
     ) latest
       ON j.application_id = latest.application_id
      AND j.job_type = latest.job_type
      AND j.created_at = latest.max_created
     JOIN applications a ON a.id = j.application_id
     WHERE j.status = 'processing'
       AND j.started_at < NOW() - ($1::text || ' minutes')::interval
       AND a.application_status NOT IN ('sent', 'cancelled', 'needs_review')
       AND a.review_reason IS NULL`,
    [String(olderThanMinutes)]
  );
  return rows;
}

async function findRecoverableStuckQueuedJobs(olderThanMinutes = 5, client = pool) {
  const { rows } = await client.query(
    `SELECT j.*, a.application_status, a.review_reason, a.user_id,
            a.recipient_email, jd.contact_email
     FROM application_jobs j
     INNER JOIN (
       SELECT application_id, job_type, MAX(created_at) AS max_created
       FROM application_jobs
       GROUP BY application_id, job_type
     ) latest
       ON j.application_id = latest.application_id
      AND j.job_type = latest.job_type
      AND j.created_at = latest.max_created
     JOIN applications a ON a.id = j.application_id
     LEFT JOIN job_descriptions jd ON jd.id = a.job_description_id
     WHERE j.status = 'queued'
       AND j.created_at < NOW() - ($1::text || ' minutes')::interval
       AND a.application_status NOT IN ('sent', 'cancelled', 'needs_review')
       AND a.review_reason IS NULL`,
    [String(olderThanMinutes)]
  );
  return rows;
}

/** @deprecated Use findRecoverableStuckProcessingJobs */
async function findStuckProcessingJobs(olderThanMinutes = 15, client = pool) {
  return findRecoverableStuckProcessingJobs(olderThanMinutes, client);
}

/** @deprecated Use findRecoverableStuckQueuedJobs */
async function findStuckQueuedJobs(olderThanMinutes = 5, client = pool) {
  return findRecoverableStuckQueuedJobs(olderThanMinutes, client);
}

module.exports = {
  createJob,
  getJobById,
  getLatestJobByType,
  getLatestJobsForApplication,
  hasActiveJob,
  hasCompletedSendJob,
  findRecoverableStuckProcessingJobs,
  findRecoverableStuckQueuedJobs,
  findStuckProcessingJobs,
  findStuckQueuedJobs,
};
