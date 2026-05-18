/**
 * Canonical model identifier normalization.
 *
 * Model IDs are infrastructure identifiers (not display names). Provider APIs
 * are the source of truth for validity; this module only enforces hygiene:
 * trim, printable ASCII allowlist, max length, lowercase canonical form.
 *
 * Allowed characters: a-z, 0-9, /, -, _, ., :
 * Uses plain toLowerCase() after ASCII validation (not locale-specific APIs).
 */

const MODEL_MAX_LENGTH = 256;
const MODEL_ASCII_PATTERN = /^[A-Za-z0-9/_.:-]+$/;

/**
 * @param {unknown} model
 * @param {{ required?: boolean }} [options]
 * @returns {{
 *   ok: boolean,
 *   model?: string,
 *   code?: string,
 *   message?: string,
 *   normalizedFrom?: string,
 * }}
 */
function normalizeModelInput(model, { required = false } = {}) {
  if (model === null || model === undefined) {
    if (required) {
      return { ok: false, code: "MODEL_REQUIRED", message: "Model is required" };
    }
    return { ok: true, model: null };
  }

  if (typeof model !== "string") {
    return {
      ok: false,
      code: "INVALID_MODEL_FORMAT",
      message: "Model must be a string",
    };
  }

  const trimmed = model.trim();
  if (!trimmed) {
    if (required) {
      return { ok: false, code: "MODEL_REQUIRED", message: "Model is required" };
    }
    return { ok: true, model: null };
  }

  if (!MODEL_ASCII_PATTERN.test(trimmed)) {
    return {
      ok: false,
      code: "INVALID_MODEL_FORMAT",
      message:
        "Model ID must use only letters, numbers, and / - _ . : (printable ASCII)",
    };
  }

  if (trimmed.length > MODEL_MAX_LENGTH) {
    return {
      ok: false,
      code: "INVALID_MODEL_FORMAT",
      message: `Model ID must be at most ${MODEL_MAX_LENGTH} characters`,
    };
  }

  const canonical = trimmed.toLowerCase();
  const result = { ok: true, model: canonical };
  if (canonical !== trimmed) {
    result.normalizedFrom = trimmed;
  }
  return result;
}

module.exports = {
  normalizeModelInput,
  MODEL_MAX_LENGTH,
  MODEL_ASCII_PATTERN,
};
