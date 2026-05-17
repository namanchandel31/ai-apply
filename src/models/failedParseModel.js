const { pool } = require("../db");
const { logInfo, logError } = require("../utils/logger");
const { sanitizeTextForStorage, sanitizeErrorMessage } = require("../utils/textSanitize");

const VALID_SOURCES = new Set(["resume", "jd"]);

/**
 * Upserts a failed parse record. All text is sanitized before insert.
 */
const saveFailedParse = async (fileHash, sourceType, rawText, errorMessage) => {
  if (!fileHash || typeof fileHash !== "string") {
    throw new Error("saveFailedParse: fileHash is required");
  }

  if (!VALID_SOURCES.has(sourceType)) {
    throw new Error(`saveFailedParse: invalid sourceType "${sourceType}"`);
  }

  const safeText = sanitizeTextForStorage(rawText ?? "");
  const safeError = sanitizeErrorMessage(errorMessage);

  if (!safeText) {
    logInfo("fallback_storage_skipped", {
      fileHash,
      sourceType,
      reason: "empty_text_after_sanitize",
    });
    return null;
  }

  const query = `
    INSERT INTO failed_parses (file_hash, source_type, raw_text, error_message, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (file_hash)
    DO UPDATE SET
      source_type = EXCLUDED.source_type,
      raw_text = EXCLUDED.raw_text,
      error_message = EXCLUDED.error_message,
      updated_at = EXCLUDED.updated_at
    RETURNING id, file_hash, source_type, created_at, updated_at;
  `;

  try {
    const { rows } = await pool.query(query, [
      fileHash,
      sourceType,
      safeText,
      safeError,
    ]);

    logInfo("fallback_storage_success", {
      fileHash,
      sourceType,
      rawTextChars: safeText.length,
    });

    return rows[0];
  } catch (err) {
    logError("fallback_storage_failed", err, {
      fileHash,
      sourceType,
      rawTextChars: safeText.length,
      pgCode: err.code,
    });
    throw err;
  }
};

module.exports = {
  saveFailedParse,
};
