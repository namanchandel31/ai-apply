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
const createResume = async (client, fileName, fileSize, fileHash) => {
  const { rows } = await client.query(
    `INSERT INTO resumes (file_name, file_size, file_hash)
     VALUES ($1, $2, $3)
     RETURNING id, file_name, file_size, file_hash, uploaded_at`,
    [fileName, fileSize, fileHash]
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
 * @returns {Promise<{resumeId: string, parsedResumeId: string, parsedJson: object} | null>}
 */
const findResumeByHash = async (fileHash) => {
  const { rows } = await pool.query(
    `SELECT r.id AS resume_id, pr.id AS parsed_resume_id, pr.parsed_json
     FROM resumes r
     JOIN parsed_resumes pr ON pr.resume_id = r.id
     WHERE r.file_hash = $1
     ORDER BY pr.created_at DESC
     LIMIT 1`,
    [fileHash]
  );

  if (rows.length === 0) return null;

  return {
    resumeId: rows[0].resume_id,
    parsedResumeId: rows[0].parsed_resume_id,
    parsedJson: rows[0].parsed_json,
  };
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
const createResumeWithParsedData = async (fileName, fileSize, fileHash, rawText, parsedJson) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resume = await createResume(client, fileName, fileSize, fileHash);
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

module.exports = {
  createResume,
  saveParsedResume,
  findResumeByHash,
  createResumeWithParsedData,
};
