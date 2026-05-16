const { pool } = require("../db");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum send attempts before an application is permanently abandoned. */
const MAX_RETRIES = 3;

/** Jobs stuck in 'processing' longer than this are eligible for stale recovery. */
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

/**
 * Check if an application already exists for this resume + JD combination.
 */
const getApplicationByResumeAndJD = async (resumeId, jobDescriptionId, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT a.id, a.match_score, a.email_subject, a.email_body, a.status,
              a.email_status, a.retry_count, a.sent_at, a.failed_at, a.error,
              r.file_path
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.resume_id = $1 AND a.job_description_id = $2 AND a.user_id = $3
       LIMIT 1`
    : `SELECT a.id, a.match_score, a.email_subject, a.email_body, a.status,
              a.email_status, a.retry_count, a.sent_at, a.failed_at, a.error,
              r.file_path
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.resume_id = $1 AND a.job_description_id = $2
       LIMIT 1`;

  const params = userId ? [resumeId, jobDescriptionId, userId] : [resumeId, jobDescriptionId];
  const { rows } = await queryClient.query(query, params);
  if (rows.length === 0) return null;
  return rows[0];
};

/**
 * Fetch application by ID with resume file_path.
 * user_id scoping enforced in WHERE — null result = not found OR not owned (both → 404).
 */
const getApplicationById = async (applicationId, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT a.*, jd.contact_email as jd_contact_email, r.file_path
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`
    : `SELECT a.*, jd.contact_email as jd_contact_email, r.file_path
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1`;

  const params = userId ? [applicationId, userId] : [applicationId];
  const { rows } = await queryClient.query(query, params);
  if (rows.length === 0) return null;
  return rows[0];
};

// ---------------------------------------------------------------------------
// Write queries
// ---------------------------------------------------------------------------

/**
 * Create or update an application draft.
 * ON CONFLICT resolves races by bumping updated_at and returning the existing record.
 */
const createApplication = async ({ id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody, userId = null, client = null }) => {
  const queryClient = client || pool;

  const { rows } = await queryClient.query(
    `INSERT INTO applications (
        id, resume_id, job_description_id, match_score, email_subject, email_body, status, user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
     ON CONFLICT (user_id, resume_id, job_description_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, match_score, email_subject, email_body, status, created_at, updated_at`,
    [id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody, userId]
  );

  const isExisting = rows[0].created_at.getTime() !== rows[0].updated_at.getTime();
  return { ...rows[0], idempotent: isExisting };
};

/**
 * Update application status with atomic update.
 * Used by the legacy send path; new path uses the state machine functions below.
 */
const updateApplicationStatus = async (applicationId, status, error = null, userId = null, client = null) => {
  const queryClient = client || pool;
  const validStages = ["smtp", "validation", "storage", "unknown"];

  if (error && error.stage && !validStages.includes(error.stage)) {
    throw new Error(`Invalid error stage: ${error.stage}. Must be one of: ${validStages.join(", ")}`);
  }

  const errorJson = error ? JSON.stringify(error) : null;

  const query = userId
    ? `UPDATE applications
       SET status = $1, error = $2, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END
       WHERE id = $3 AND user_id = $4
       RETURNING id, status, sent_at, error`
    : `UPDATE applications
       SET status = $1, error = $2, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END
       WHERE id = $3
       RETURNING id, status, sent_at, error`;

  const params = userId ? [status, errorJson, applicationId, userId] : [status, errorJson, applicationId];
  const { rows } = await queryClient.query(query, params);
  if (rows.length === 0) return null;
  return rows[0];
};

// ---------------------------------------------------------------------------
// State machine — atomic CAS transitions
//
// All functions check email_status = '<prior_state>' in the WHERE clause.
// PostgreSQL guarantees atomicity on a single-row UPDATE … WHERE.
// No advisory locks, no Redis, no SELECT … FOR UPDATE needed.
// ---------------------------------------------------------------------------

/**
 * CAS: pending → processing.
 *
 * Sets processing_started_at = NOW().
 * Returns the updated row if this caller won the race.
 * Returns null if another worker already grabbed the job (idempotent — caller should exit).
 *
 * @param {string} applicationId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
const markProcessing = async (applicationId, userId) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET email_status = 'processing', processing_started_at = NOW()
     WHERE id = $1 AND user_id = $2 AND email_status = 'pending'
     RETURNING id, email_status, retry_count, processing_started_at`,
    [applicationId, userId]
  );
  return rows[0] ?? null;
};

/**
 * CAS: processing → sent.
 *
 * Sets sent_at = NOW(). Persists the SMTP provider message ID in the dedicated
 * smtp_message_id column (NEVER overloads last_error). Clears last_error.
 * Returns null if the row is not in 'processing' state (already resolved by another worker).
 *
 * @param {string} applicationId
 * @param {string} userId
 * @param {string|null} smtpMessageId  - Message ID from nodemailer's sendMail result.
 * @returns {Promise<object|null>}
 */
const markSent = async (applicationId, userId, smtpMessageId) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET email_status = 'sent',
         sent_at = NOW(),
         smtp_message_id = $3,
         last_error = NULL
     WHERE id = $1 AND user_id = $2 AND email_status = 'processing'
     RETURNING id, email_status, sent_at, smtp_message_id`,
    [applicationId, userId, smtpMessageId ?? null]
  );
  return rows[0] ?? null;
};

/**
 * CAS: processing → failed | abandoned.
 *
 * Increments retry_count. Sets failed_at = NOW().
 * If (retry_count + 1) >= MAX_RETRIES → moves to 'abandoned' (permanent, no more retries).
 * Otherwise → moves to 'failed' (eligible for retry on next sendApplication() call).
 *
 * @param {string} applicationId
 * @param {string} userId
 * @param {string} errorMessage
 * @returns {Promise<object|null>}
 */
const markFailed = async (applicationId, userId, errorMessage) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET
       email_status = CASE
         WHEN retry_count + 1 >= $3 THEN 'abandoned'::app_email_status
         ELSE 'failed'::app_email_status
       END,
       retry_count = retry_count + 1,
       last_error  = $4,
       failed_at   = NOW()
     WHERE id = $1 AND user_id = $2 AND email_status = 'processing'
     RETURNING id, email_status, retry_count, failed_at`,
    [applicationId, userId, MAX_RETRIES, errorMessage]
  );
  return rows[0] ?? null;
};

/**
 * Stale processing recovery.
 *
 * Finds jobs stuck in 'processing' for longer than STALE_PROCESSING_MS (10 min).
 *
 * IMPORTANT — retry_count is incremented here. Without this, a job can loop
 * forever: processing → stale → pending → processing → stale…
 * Each stale recovery counts as one retry attempt toward MAX_RETRIES.
 *
 * Transition:
 *   - (retry_count + 1) >= MAX_RETRIES → 'abandoned' (permanent failure)
 *   - Otherwise → 'pending' (eligible for re-pickup by next sendApplication() call)
 *
 * Multi-instance safety: PostgreSQL row-level locking on UPDATE ensures each row
 * is updated by exactly one instance even if multiple call this concurrently.
 * The second writer simply gets zero rows back, which is correct and logged.
 *
 * @returns {Promise<Array>} Updated rows (for logging/monitoring).
 */
const recoverStaleProcessing = async () => {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { rows } = await pool.query(
    `UPDATE applications
     SET
       email_status = CASE
         WHEN retry_count + 1 >= $2 THEN 'abandoned'::app_email_status
         ELSE 'pending'::app_email_status
       END,
       retry_count = retry_count + 1,
       last_error  = 'recovered from stale processing state'
     WHERE email_status = 'processing'
       AND processing_started_at < $1
     RETURNING id, email_status, retry_count`,
    [cutoff, MAX_RETRIES]
  );
  return rows;
};

module.exports = {
  // Read
  getApplicationByResumeAndJD,
  getApplicationById,
  // Write
  createApplication,
  updateApplicationStatus,
  // State machine
  markProcessing,
  markSent,
  markFailed,
  recoverStaleProcessing,
  // Constants (exported for use in services)
  MAX_RETRIES,
};
