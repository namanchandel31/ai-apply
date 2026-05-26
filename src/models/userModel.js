const { pool } = require("../db");

async function findBySupabaseUserId(supabaseUserId) {
  const { rows } = await pool.query(
    `SELECT id, supabase_user_id, email, full_name, avatar_url, created_at, last_login_at
     FROM users WHERE supabase_user_id = $1`,
    [supabaseUserId]
  );
  return rows[0] ?? null;
}

/**
 * Legacy rows awaiting manual link (supabase_user_id IS NULL).
 */
async function findUnmappedUsersByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email FROM users
     WHERE supabase_user_id IS NULL AND LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows;
}

/**
 * Update profile fields on an existing row — never changes users.id.
 */
async function updateUserProfileFromSupabase(userId, { email, fullName, avatarUrl }) {
  const { rows } = await pool.query(
    `UPDATE users SET
       email = $2,
       full_name = CASE
         WHEN profile_customized_at IS NOT NULL THEN full_name
         WHEN full_name IS NULL THEN $3
         ELSE full_name
       END,
       avatar_url = CASE
         WHEN profile_customized_at IS NOT NULL THEN avatar_url
         WHEN avatar_url IS NULL THEN $4
         ELSE avatar_url
       END,
       last_login_at = NOW()
     WHERE id = $1
     RETURNING id, supabase_user_id, email, full_name, avatar_url, created_at, last_login_at`,
    [userId, email, fullName, avatarUrl]
  );
  return rows[0];
}

/**
 * Insert a new user for first-time Google sign-in (not a legacy manual link).
 * ON CONFLICT on supabase_user_id is race-safe for concurrent first logins.
 */
async function insertNewUserFromSupabase({ supabaseUserId, email, fullName, avatarUrl }) {
  const { rows } = await pool.query(
    `INSERT INTO users (supabase_user_id, email, full_name, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (supabase_user_id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.full_name
         WHEN users.full_name IS NULL THEN EXCLUDED.full_name
         ELSE users.full_name
       END,
       avatar_url = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.avatar_url
         WHEN users.avatar_url IS NULL THEN EXCLUDED.avatar_url
         ELSE users.avatar_url
       END,
       last_login_at = NOW()
     RETURNING id, supabase_user_id, email, full_name, avatar_url, created_at, last_login_at`,
    [supabaseUserId, email, fullName, avatarUrl]
  );
  return rows[0];
}

async function getUserById(userId) {
  const { rows } = await pool.query(
    `SELECT id, supabase_user_id, email, full_name, avatar_url, created_at, last_login_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function touchUserLastLogin(userId) {
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

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
  findBySupabaseUserId,
  findUnmappedUsersByEmail,
  updateUserProfileFromSupabase,
  insertNewUserFromSupabase,
  getUserById,
  touchUserLastLogin,
  getUserDefaults,
  setUserDefaults,
  autoPopulateDefaultResume,
};
