/**
 * Job Description persistence model.
 *
 * All writes go through createJDWithParsedData() which wraps
 * both inserts in a single DB transaction (BEGIN → COMMIT / ROLLBACK).
 */

const { pool } = require("../db");

// ---------------------------------------------------------------------------
// Low-level insert functions (operate on a provided client for tx control)
// ---------------------------------------------------------------------------

/**
 * Insert a job description row.
 * @param {import('pg').PoolClient} client
 * @param {string|null} title
 * @param {string} rawText
 * @returns {Promise<{id: string, title: string|null, created_at: string}>}
 */
const createJobDescription = async (client, title, rawText) => {
  const { rows } = await client.query(
    `INSERT INTO job_descriptions (title, raw_text)
     VALUES ($1, $2)
     RETURNING id, title, created_at`,
    [title || null, rawText]
  );
  return rows[0];
};

/**
 * Insert a parsed JD row linked to a job description.
 * @param {import('pg').PoolClient} client
 * @param {string} jobDescriptionId
 * @param {object} parsedJson
 * @returns {Promise<{id: string, job_description_id: string, created_at: string}>}
 */
const saveParsedJD = async (client, jobDescriptionId, parsedJson) => {
  const { rows } = await client.query(
    `INSERT INTO parsed_job_descriptions (job_description_id, parsed_json)
     VALUES ($1, $2)
     RETURNING id, job_description_id, created_at`,
    [jobDescriptionId, JSON.stringify(parsedJson)]
  );
  return rows[0];
};

// ---------------------------------------------------------------------------
// Transactional wrapper (single public entry point for controllers)
// ---------------------------------------------------------------------------

/**
 * Atomically create a JD + its parsed data in one transaction.
 *
 * @param {string|null} title - optional JD title
 * @param {string} rawText - raw JD text from user
 * @param {object} parsedJson - validated + normalized LLM output
 * @returns {Promise<{jobDescriptionId: string, parsedJobDescriptionId: string}>}
 */
const createJDWithParsedData = async (title, rawText, parsedJson) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const jd = await createJobDescription(client, title, rawText);
    const parsed = await saveParsedJD(client, jd.id, parsedJson);

    await client.query("COMMIT");

    return {
      jobDescriptionId: jd.id,
      parsedJobDescriptionId: parsed.id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`JD DB transaction failed: ${err.message}`);
  } finally {
    client.release();
  }
};

/**
 * Fetch a job description by ID joined with its most recent parsed data.
 * @param {string} jobDescriptionId 
 * @returns {Promise<{jobDescriptionId: string, parsedJobDescriptionId: string, parsedJson: object} | null>}
 */
const getJDById = async (jobDescriptionId) => {
  const { rows } = await pool.query(
    `SELECT jd.id AS job_description_id, pjd.id AS parsed_job_description_id, pjd.parsed_json
     FROM job_descriptions jd
     JOIN parsed_job_descriptions pjd ON pjd.job_description_id = jd.id
     WHERE jd.id = $1
     ORDER BY pjd.created_at DESC
     LIMIT 1`,
    [jobDescriptionId]
  );

  if (rows.length === 0) return null;

  return {
    jobDescriptionId: rows[0].job_description_id,
    parsedJobDescriptionId: rows[0].parsed_job_description_id,
    parsedJson: rows[0].parsed_json,
  };
};

module.exports = {
  createJobDescription,
  saveParsedJD,
  createJDWithParsedData,
  getJDById,
};
