/**
 * Normalizes an array of skill strings:
 * - Lowercases each skill
 * - Trims whitespace
 * - Removes empty strings
 * - Deduplicates
 *
 * @param {string[]} skills
 * @returns {string[]}
 */
const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  return [...new Set(skills.map((s) => s.toLowerCase().trim()).filter(Boolean))];
};

/**
 * Converts empty or whitespace-only strings to null.
 * Passes through null and valid non-empty strings unchanged.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
const nullifyEmpty = (value) => {
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

module.exports = { normalizeSkills, nullifyEmpty };
