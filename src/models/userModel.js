const { pool } = require("../db");
const { buildFullName, splitFullName } = require("../utils/deriveNameFromEmail");

const USER_COLUMNS = `id, supabase_user_id, email, first_name, last_name, full_name, avatar_url, created_at, last_login_at, profile_customized_at`;

async function findBySupabaseUserId(supabaseUserId) {
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}
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
  const { firstName, lastName } = splitFullName(fullName);
  const { rows } = await pool.query(
    `UPDATE users SET
       email = $2,
       full_name = CASE
         WHEN profile_customized_at IS NOT NULL THEN full_name
         WHEN full_name IS NULL THEN $3
         ELSE full_name
       END,
       first_name = CASE
         WHEN profile_customized_at IS NOT NULL THEN first_name
         WHEN first_name IS NULL AND $3 IS NOT NULL THEN $4
         ELSE first_name
       END,
       last_name = CASE
         WHEN profile_customized_at IS NOT NULL THEN last_name
         WHEN last_name IS NULL AND $3 IS NOT NULL THEN $5
         ELSE last_name
       END,
       avatar_url = CASE
         WHEN profile_customized_at IS NOT NULL THEN avatar_url
         WHEN avatar_url IS NULL THEN $6
         ELSE avatar_url
       END,
       last_login_at = NOW()
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, email, fullName, firstName, lastName, avatarUrl]
  );
  return rows[0];
}

/**
 * Insert a new user for first-time Google sign-in (not a legacy manual link).
 * ON CONFLICT on supabase_user_id is race-safe for concurrent first logins.
 */
async function insertNewUserFromSupabase({ supabaseUserId, email, fullName, avatarUrl }) {
  const { firstName, lastName } = splitFullName(fullName);
  const { rows } = await pool.query(
    `INSERT INTO users (supabase_user_id, email, full_name, first_name, last_name, avatar_url, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (supabase_user_id) DO UPDATE SET
       email = EXCLUDED.email,
       full_name = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.full_name
         WHEN users.full_name IS NULL THEN EXCLUDED.full_name
         ELSE users.full_name
       END,
       first_name = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.first_name
         WHEN users.first_name IS NULL AND EXCLUDED.full_name IS NOT NULL THEN EXCLUDED.first_name
         ELSE users.first_name
       END,
       last_name = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.last_name
         WHEN users.last_name IS NULL AND EXCLUDED.full_name IS NOT NULL THEN EXCLUDED.last_name
         ELSE users.last_name
       END,
       avatar_url = CASE
         WHEN users.profile_customized_at IS NOT NULL THEN users.avatar_url
         WHEN users.avatar_url IS NULL THEN EXCLUDED.avatar_url
         ELSE users.avatar_url
       END,
       last_login_at = NOW()
     RETURNING ${USER_COLUMNS}`,
    [supabaseUserId, email, fullName, firstName, lastName, avatarUrl]
  );
  return rows[0];
}

async function getUserById(userId) {
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS}
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function updateUserProfile(userId, { firstName, lastName }) {
  const trimmedFirst = typeof firstName === "string" ? firstName.trim() : "";
  const trimmedLast = typeof lastName === "string" ? lastName.trim() : "";
  const fullName = buildFullName(trimmedFirst, trimmedLast);

  const { rows } = await pool.query(
    `UPDATE users SET
       first_name = $2,
       last_name = $3,
       full_name = $4,
       profile_customized_at = NOW()
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, trimmedFirst || null, trimmedLast || null, fullName]
  );
  return rows[0] || null;
}

/**
 * Seed first/last name from email when the user has no name yet (onboarding).
 * Does not set profile_customized_at so IdP sync can still fill Google name later.
 */
async function seedProfileFromEmail(userId, { firstName, lastName }) {
  const fullName = buildFullName(firstName, lastName);
  const { rows } = await pool.query(
    `UPDATE users SET
       first_name = CASE
         WHEN first_name IS NULL AND full_name IS NULL THEN $2
         ELSE first_name
       END,
       last_name = CASE
         WHEN first_name IS NULL AND full_name IS NULL THEN $3
         ELSE last_name
       END,
       full_name = CASE
         WHEN first_name IS NULL AND full_name IS NULL THEN $4
         ELSE full_name
       END
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, firstName, lastName, fullName]
  );
  return rows[0] || null;
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
async function getEmailPreferenceLevels(userId) {
  const { rows } = await pool.query(
    `SELECT email_tone_level as "emailToneLevel",
            email_structure_level as "emailStructureLevel"
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function setEmailPreferenceLevels(userId, { emailToneLevel, emailStructureLevel }) {
  const { clampLevel } = require("../services/emailPreferenceMapper");
  const tone = clampLevel(emailToneLevel, 50);
  const structure = clampLevel(emailStructureLevel, 60);
  const { rows } = await pool.query(
    `UPDATE users
     SET email_tone_level = $2,
         email_structure_level = $3
     WHERE id = $1
     RETURNING email_tone_level as "emailToneLevel",
               email_structure_level as "emailStructureLevel"`,
    [userId, tone, structure]
  );
  return rows[0] || null;
}

/** Set the user's active resume after upload/replace (always points at latest upload). */
const autoPopulateDefaultResume = async (userId, resumeId) => {
  const { rows } = await pool.query(
    `UPDATE users
     SET default_resume_id = $2
     WHERE id = $1
     RETURNING id, default_resume_id`,
    [userId, resumeId]
  );
  return rows[0] || null;
};

module.exports = {
  findBySupabaseUserId,
  findUnmappedUsersByEmail,
  updateUserProfileFromSupabase,
  insertNewUserFromSupabase,
  getUserById,
  updateUserProfile,
  seedProfileFromEmail,
  touchUserLastLogin,
  getUserDefaults,
  setUserDefaults,
  getEmailPreferenceLevels,
  setEmailPreferenceLevels,
  autoPopulateDefaultResume,
};
