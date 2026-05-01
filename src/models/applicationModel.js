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
    `SELECT id, match_score, email_subject, email_body, status, created_at, updated_at
     FROM applications
     WHERE resume_id = $1 AND job_description_id = $2
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

module.exports = {
  getApplicationByResumeAndJD,
  createApplication
};
