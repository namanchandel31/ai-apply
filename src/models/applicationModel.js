const { pool } = require("../db");

/**
 * Check if an application already exists for this resume and JD combination.
 * 
 * @param {string} resumeId 
 * @param {string} jobDescriptionId 
 * @returns {Promise<Object|null>}
 */
const getApplicationByResumeAndJD = async (resumeId, jobDescriptionId) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.match_score, a.email_subject, a.email_body, a.status, a.created_at, a.updated_at, a.sent_at, a.error,
            r.file_path
     FROM applications a
     LEFT JOIN resumes r ON r.id = a.resume_id
     WHERE a.resume_id = $1 AND a.job_description_id = $2
     LIMIT 1`,
    [resumeId, jobDescriptionId]
  );

  if (rows.length === 0) return null;
  return rows[0];
};

/**
 * Create or update an application draft.
 * Resolves race conditions by updating the 'updated_at' timestamp on conflict and returning the existing record.
 * 
 * @param {Object} data
 * @param {string} data.id - UUID for the new application
 * @param {string} data.resumeId
 * @param {string} data.jobDescriptionId
 * @param {number} data.matchScore
 * @param {string} data.emailSubject
 * @param {string} data.emailBody
 * @returns {Promise<Object>}
 */
const createApplication = async ({ id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody }) => {
  const { rows } = await pool.query(
    `INSERT INTO applications (
        id, resume_id, job_description_id, match_score, email_subject, email_body, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     ON CONFLICT (resume_id, job_description_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, match_score, email_subject, email_body, status, created_at, updated_at`,
    [id, resumeId, jobDescriptionId, matchScore, emailSubject, emailBody]
  );
  
  return rows[0];
};

/**
 * Get application by ID with resume file_path
 * @param {string} applicationId
 * @returns {Promise<Object|null>}
 */
const getApplicationById = async (applicationId) => {
  const { rows } = await pool.query(
    `SELECT a.*, jd.contact_email as jd_contact_email, r.file_path
     FROM applications a
     JOIN job_descriptions jd ON jd.id = a.jd_id
     LEFT JOIN resumes r ON r.id = a.resume_id
     WHERE a.id = $1`,
    [applicationId]
  );

  if (rows.length === 0) return null;
  return rows[0];
};

/**
 * Update application status with atomic update and RETURNING
 * @param {string} applicationId
 * @param {string} status
 * @param {Object|null} error
 * @returns {Promise<Object|null>}
 */
const updateApplicationStatus = async (applicationId, status, error = null) => {
  const validStages = ["smtp", "validation", "storage", "unknown"];
  
  if (error && error.stage && !validStages.includes(error.stage)) {
    throw new Error(`Invalid error stage: ${error.stage}. Must be one of: ${validStages.join(', ')}`);
  }

  const errorJson = error ? JSON.stringify(error) : null;
  
  const { rows } = await pool.query(
    `UPDATE applications 
     SET status = $1, error = $2, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END
     WHERE id = $3
     RETURNING id, status, sent_at, error`,
    [status, errorJson, applicationId]
  );

  if (rows.length === 0) return null;
  return rows[0];
};

module.exports = {
  getApplicationByResumeAndJD,
  createApplication,
  getApplicationById,
  updateApplicationStatus
};
