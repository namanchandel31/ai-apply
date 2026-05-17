const { MAX_LLM_INPUT_CHARS, MAX_STORAGE_TEXT_CHARS } = require("../config/parsingConfig");

/**
 * Remove NULL bytes and invalid UTF-8 sequences for Postgres TEXT columns.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeTextForStorage = (text, maxLen = MAX_STORAGE_TEXT_CHARS) => {
  if (text == null) return "";
  let s = String(text);
  // Strip NULL bytes (Postgres UTF8 rejects 0x00)
  s = s.replace(/\0/g, "");
  // Drop lone surrogate halves / other non-characters
  s = s.replace(/[\uD800-\uDFFF]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
  }
  return s;
};

/**
 * Sanitize PDF-extracted text before sending to OpenAI.
 * Normalizes whitespace and caps payload size.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeTextForLlm = (text, maxLen = MAX_LLM_INPUT_CHARS) => {
  const base = sanitizeTextForStorage(text, maxLen);
  if (base.length <= maxLen) return base;

  const keepStart = Math.floor(maxLen * 0.6);
  const keepEnd = maxLen - keepStart - 5;
  return `${base.slice(0, keepStart)} ... ${base.slice(base.length - keepEnd)}`;
};

/**
 * Safe error message for DB persistence.
 * @param {unknown} err
 * @param {number} maxLen
 */
const sanitizeErrorMessage = (err, maxLen = 2000) => {
  const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
  return sanitizeTextForStorage(msg, maxLen);
};

module.exports = {
  sanitizeTextForStorage,
  sanitizeTextForLlm,
  sanitizeErrorMessage,
};
