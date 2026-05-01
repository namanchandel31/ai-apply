const { pool } = require("../db");

/**
 * Upserts a failed parse record into the failed_parses table.
 * 
 * @param {string} fileHash - SHA-256 hash of the original input.
 * @param {string} sourceType - "resume" or "jd".
 * @param {string} rawText - The extracted text that failed parsing.
 * @param {string} errorMessage - Description of the failure.
 * @returns {Promise<object>} The inserted/updated row.
 */
const saveFailedParse = async (fileHash, sourceType, rawText, errorMessage) => {
  const query = `
    INSERT INTO failed_parses (file_hash, source_type, raw_text, error_message, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (file_hash) 
    DO UPDATE SET 
      error_message = EXCLUDED.error_message,
      updated_at = EXCLUDED.updated_at
    RETURNING id, file_hash, source_type, created_at, updated_at;
  `;
  
  const { rows } = await pool.query(query, [fileHash, sourceType, rawText, errorMessage]);
  return rows[0];
};

module.exports = {
  saveFailedParse,
};
