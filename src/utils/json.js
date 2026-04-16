/**
 * Safely parse a JSON string. Returns null on failure — never throws.
 * @param {string} raw
 * @returns {object|null}
 */
const safeParseJSON = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

module.exports = { safeParseJSON };
