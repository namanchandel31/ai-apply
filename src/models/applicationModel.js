const { pool } = require("../db");

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
              a.email_status, a.processing_attempts, a.sent_at, a.failed_at, a.error,
              r.file_path
       FROM applications a
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.resume_id = $1 AND a.job_description_id = $2 AND a.user_id = $3
       LIMIT 1`
    : `SELECT a.id, a.match_score, a.email_subject, a.email_body, a.status,
              a.email_status, a.processing_attempts, a.sent_at, a.failed_at, a.error,
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

/**
 * findRecentDuplicate for auto-apply to prevent duplicate recruiter emails
 */
const findRecentDuplicate = async (userId, recipientEmail, normalizedJobTitle, normalizedCompanyName) => {
  const { rows } = await pool.query(
    `SELECT id, email_status, email_subject, email_body, created_at
     FROM applications
     WHERE user_id = $1 
       AND recipient_email = $2
       AND normalized_job_title = $3 
       AND normalized_company_name = $4
       AND created_at > NOW() - interval '24 hours'
     LIMIT 1`,
    [userId, recipientEmail, normalizedJobTitle, normalizedCompanyName]
  );
  if (rows.length === 0) return null;
  return rows[0];
};

// ---------------------------------------------------------------------------
// Write queries
// ---------------------------------------------------------------------------

/**
 * Create or update an application draft.
 * Extended for auto-apply fields.
 */
const createApplication = async ({
  id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody, userId = null, client = null,
  emailStatus = 'draft', recipientEmail = null, resumeSnapshotPath = null,
  normalizedJobTitle = null, normalizedCompanyName = null,
  parsedJdSnapshot = null, parsedResumeSnapshot = null, matchScoreSnapshot = null
}) => {
  const queryClient = client || pool;

  const { rows } = await queryClient.query(
    `INSERT INTO applications (
        id, resume_id, job_description_id, match_score, email_subject, email_body, status, user_id,
        email_status, recipient_email, resume_snapshot_path, normalized_job_title, normalized_company_name,
        parsed_jd_snapshot, parsed_resume_snapshot, match_score_snapshot
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (user_id, resume_id, job_description_id)
     DO UPDATE SET 
        updated_at = NOW(),
        email_status = EXCLUDED.email_status,
        recipient_email = EXCLUDED.recipient_email,
        resume_snapshot_path = EXCLUDED.resume_snapshot_path,
        normalized_job_title = EXCLUDED.normalized_job_title,
        normalized_company_name = EXCLUDED.normalized_company_name,
        parsed_jd_snapshot = EXCLUDED.parsed_jd_snapshot,
        parsed_resume_snapshot = EXCLUDED.parsed_resume_snapshot,
        match_score_snapshot = EXCLUDED.match_score_snapshot
     RETURNING id, match_score, email_subject, email_body, status, created_at, updated_at`,
    [
      id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody, userId,
      emailStatus, recipientEmail, resumeSnapshotPath, normalizedJobTitle, normalizedCompanyName,
      parsedJdSnapshot ? JSON.stringify(parsedJdSnapshot) : null,
      parsedResumeSnapshot ? JSON.stringify(parsedResumeSnapshot) : null,
      matchScoreSnapshot
    ]
  );

  const isExisting = rows[0].created_at.getTime() !== rows[0].updated_at.getTime();
  return { ...rows[0], idempotent: isExisting };
};

/**
 * Update application status with atomic update.
 * Used by the legacy send path.
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
// ---------------------------------------------------------------------------

/**
 * Legacy CAS: pending → processing.
 */
const markProcessing = async (applicationId, userId) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET email_status = 'processing', processing_started_at = NOW(),
         processing_attempts = processing_attempts + 1,
         last_processing_attempt_at = NOW()
     WHERE id = $1 AND user_id = $2 AND email_status = 'pending'
     RETURNING id, email_status, processing_attempts, processing_started_at`,
    [applicationId, userId]
  );
  return rows[0] ?? null;
};

/**
 * Auto-Apply CAS: queued → processing.
 */
const markProcessingFromQueued = async (applicationId) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET email_status = 'processing', processing_started_at = NOW(),
         processing_attempts = processing_attempts + 1,
         last_processing_attempt_at = NOW()
     WHERE id = $1 AND email_status = 'queued'
     RETURNING *`,
    [applicationId]
  );
  return rows[0] ?? null;
};

/**
 * CAS: processing → sent.
 */
const markSent = async (applicationId, userId, providerMessageId = null) => {
  const query = userId 
    ? `UPDATE applications
       SET email_status = 'sent',
           sent_at = NOW(),
           provider_message_id = $3,
           last_error = NULL
       WHERE id = $1 AND user_id = $2 AND email_status = 'processing'
       RETURNING id, email_status, sent_at, provider_message_id`
    : `UPDATE applications
       SET email_status = 'sent',
           sent_at = NOW(),
           provider_message_id = $2,
           last_error = NULL
       WHERE id = $1 AND email_status = 'processing'
       RETURNING id, email_status, sent_at, provider_message_id`;

  const params = userId ? [applicationId, userId, providerMessageId] : [applicationId, providerMessageId];
  const { rows } = await pool.query(query, params);
  return rows[0] ?? null;
};

/**
 * CAS: queued | processing → failed.
 */
const markFailed = async (applicationId, errorMessage, failureStage, userId = null) => {
  const query = userId
    ? `UPDATE applications
       SET email_status = 'failed',
           last_error = $3,
           failure_stage = $4,
           failed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND email_status IN ('queued', 'processing')
       RETURNING id, email_status, failure_stage`
    : `UPDATE applications
       SET email_status = 'failed',
           last_error = $2,
           failure_stage = $3,
           failed_at = NOW()
       WHERE id = $1 AND email_status IN ('queued', 'processing')
       RETURNING id, email_status, failure_stage`;

  const params = userId ? [applicationId, userId, errorMessage, failureStage] : [applicationId, errorMessage, failureStage];
  const { rows } = await pool.query(query, params);
  return rows[0] ?? null;
};

/**
 * CAS: any → abandoned.
 */
const markAbandoned = async (applicationId, failureStage) => {
  const { rows } = await pool.query(
    `UPDATE applications
     SET email_status = 'abandoned', failure_stage = $2
     WHERE id = $1
     RETURNING id, email_status, failure_stage`,
    [applicationId, failureStage]
  );
  return rows[0] ?? null;
};

/**
 * Legacy stale processing recovery.
 * Note: For auto-apply, recovery is handled by src/jobs/recovery.job.js
 */
const recoverStaleProcessing = async () => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const MAX = parseInt(process.env.MAX_PROCESSING_ATTEMPTS || "5", 10);
  const { rows } = await pool.query(
    `UPDATE applications
     SET
       email_status = CASE
         WHEN processing_attempts >= $2 THEN 'abandoned'::app_email_status
         ELSE 'pending'::app_email_status
       END,
       last_error  = 'recovered from stale processing state'
     WHERE email_status = 'processing'
       AND processing_started_at < $1
     RETURNING id, email_status, processing_attempts`,
    [cutoff, MAX]
  );
  return rows;
};

module.exports = {
  // Read
  getApplicationByResumeAndJD,
  getApplicationById,
  findRecentDuplicate,
  // Write
  createApplication,
  updateApplicationStatus,
  // State machine
  markProcessing,
  markProcessingFromQueued,
  markSent,
  markFailed,
  markAbandoned,
  recoverStaleProcessing,
};
