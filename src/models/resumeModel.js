/**
 * Resume persistence model.
 *
 * All writes go through createResumeWithParsedData() which wraps
 * both inserts in a single DB transaction (BEGIN → COMMIT / ROLLBACK).
 *
 * Deduplication: if a file with the same SHA-256 hash already exists,
 * the existing IDs are returned and no new rows are created.
 */

const { pool } = require("../db");
const { logError } = require("../utils/logger");

// ---------------------------------------------------------------------------
// Low-level insert functions (operate on a provided client for tx control)
// ---------------------------------------------------------------------------

/**
 * Insert a resume metadata row.
 * @param {import('pg').PoolClient} client
 * @param {string} fileName
 * @param {number} fileSize
 * @param {string} fileHash - SHA-256 hex digest of the file buffer
 * @returns {Promise<{id: string, file_name: string, file_size: number, file_hash: string, uploaded_at: string}>}
 */
const createResume = async (client, fileName, fileSize, fileHash, userId = null, filePath = null) => {
  const { rows } = await client.query(
    `INSERT INTO resumes (file_name, file_size, file_hash, user_id, file_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, file_name, file_size, file_hash, user_id, file_path, uploaded_at`,
    [fileName, fileSize, fileHash, userId, filePath]
  );
  return rows[0];
};

/**
 * Insert a parsed resume row linked to a resume.
 * @param {import('pg').PoolClient} client
 * @param {string} resumeId
 * @param {string} rawText
 * @param {object} parsedJson
 * @returns {Promise<{id: string, resume_id: string, created_at: string}>}
 */
const saveParsedResume = async (client, resumeId, rawText, parsedJson) => {
  const { rows } = await client.query(
    `INSERT INTO parsed_resumes (resume_id, raw_text, parsed_json)
     VALUES ($1, $2, $3)
     RETURNING id, resume_id, created_at`,
    [resumeId, rawText, JSON.stringify(parsedJson)]
  );
  return rows[0];
};

/**
 * Look up an existing resume by its file hash (dedup).
 * Returns the resume row + the most recent parsed_resume id, or null.
 * @param {string} fileHash
 * @param {string} userId
 * @returns {Promise<{resumeId: string, parsedResumeId: string, parsedJson: object} | null>}
 */
const findResumeByHash = async (fileHash, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT r.id AS resume_id, pr.id AS parsed_resume_id, pr.parsed_json, r.file_path
       FROM resumes r
       LEFT JOIN parsed_resumes pr ON pr.resume_id = r.id
       WHERE r.file_hash = $1 AND r.user_id = $2
       ORDER BY pr.created_at DESC NULLS LAST
       LIMIT 1`
    : `SELECT r.id AS resume_id, pr.id AS parsed_resume_id, pr.parsed_json, r.file_path
       FROM resumes r
       LEFT JOIN parsed_resumes pr ON pr.resume_id = r.id
       WHERE r.file_hash = $1
       ORDER BY pr.created_at DESC NULLS LAST
       LIMIT 1`;

  const params = userId ? [fileHash, userId] : [fileHash];

  try {
    const { rows } = await queryClient.query(query, params);

    if (rows.length === 0) return null;

    return {
      resumeId: rows[0].resume_id,
      parsedResumeId: rows[0].parsed_resume_id,
      parsedJson: rows[0].parsed_json,
      filePath: rows[0].file_path,
    };
  } catch (err) {
    logError("find_resume_by_hash_failed", err, {
      fileHash,
      userId,
      pgCode: err.code,
      detail: err.detail,
    });
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Transactional wrapper (single public entry point for controllers)
// ---------------------------------------------------------------------------

/**
 * Atomically create a resume + its parsed data in one transaction.
 *
 * @param {string} fileName
 * @param {number} fileSize
 * @param {string} fileHash - SHA-256 hex digest
 * @param {string} rawText - cleaned text extracted from PDF
 * @param {object} parsedJson - validated + normalized LLM output
 * @returns {Promise<{resumeId: string, parsedResumeId: string}>}
 */
const createResumeWithParsedData = async (fileName, fileSize, fileHash, rawText, parsedJson, userId = null, filePath = null) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resume = await createResume(client, fileName, fileSize, fileHash, userId, filePath);
    const parsed = await saveParsedResume(client, resume.id, rawText, parsedJson);

    await client.query("COMMIT");

    return {
      resumeId: resume.id,
      parsedResumeId: parsed.id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Resume DB transaction failed: ${err.message}`);
  } finally {
    client.release();
  }
};

/**
 * Fetch a resume by ID joined with its most recent parsed data.
 * @param {string} resumeId 
 * @returns {Promise<{resumeId: string, parsedResumeId: string, parsedJson: object} | null>}
 */
const getResumeById = async (resumeId, userId = null, client = null) => {
  const queryClient = client || pool;
  const query = userId
    ? `SELECT r.id AS resume_id, pr.id AS parsed_resume_id, pr.parsed_json, r.file_path
       FROM resumes r
       JOIN parsed_resumes pr ON pr.resume_id = r.id
       WHERE r.id = $1 AND r.user_id = $2
       ORDER BY pr.created_at DESC NULLS LAST
       LIMIT 1`
    : `SELECT r.id AS resume_id, pr.id AS parsed_resume_id, pr.parsed_json, r.file_path
       FROM resumes r
       JOIN parsed_resumes pr ON pr.resume_id = r.id
       WHERE r.id = $1
       ORDER BY pr.created_at DESC NULLS LAST
       LIMIT 1`;

  const params = userId ? [resumeId, userId] : [resumeId];

  const { rows } = await queryClient.query(query, params);

  if (rows.length === 0) return null;

  return {
    resumeId: rows[0].resume_id,
    parsedResumeId: rows[0].parsed_resume_id,
    parsedJson: rows[0].parsed_json,
    filePath: rows[0].file_path,
  };
};

module.exports = {
  createResume,
  saveParsedResume,
  findResumeByHash,
  createResumeWithParsedData,
  getResumeById,
};
