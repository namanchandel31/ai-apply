const { pool } = require("../db");

/**
 * Fetch the user's defaults (resume).
 */
const getUserDefaults = async (userId) => {
  const { rows } = await pool.query(
    `SELECT default_resume_id FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  return {
    defaultResumeId: rows[0].default_resume_id,
  };
};

/**
 * Set the user's default resume manually.
 * Validates ownership of the resume.
 */
const setUserDefaults = async (userId, { defaultResumeId }) => {
  if (defaultResumeId) {
    const { rows: resumeRows } = await pool.query(
      `SELECT id FROM resumes WHERE id = $1 AND user_id = $2`,
      [defaultResumeId, userId]
    );
    if (resumeRows.length === 0) {
      throw new Error("RESUME_NOT_FOUND_OR_NOT_OWNED");
    }
  }

  const { rows } = await pool.query(
    `UPDATE users 
     SET default_resume_id = $2
     WHERE id = $1
     RETURNING id, default_resume_id`,
    [userId, defaultResumeId]
  );

  return rows[0];
};

/**
 * Auto-populate the default resume on first upload.
 * Only updates if it's currently NULL (idempotent/non-destructive).
 */
const autoPopulateDefaultResume = async (userId, resumeId) => {
  const { rows } = await pool.query(
    `UPDATE users 
     SET default_resume_id = $2
     WHERE id = $1 AND default_resume_id IS NULL
     RETURNING id, default_resume_id`,
    [userId, resumeId]
  );
  return rows[0] || null; // Returns null if not updated (meaning it wasn't NULL)
};

module.exports = {
  getUserDefaults,
  setUserDefaults,
  autoPopulateDefaultResume,
};
