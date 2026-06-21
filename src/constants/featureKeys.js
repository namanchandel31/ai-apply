/**
 * Canonical Feature Catalog keys. These mirror rows seeded in
 * `feature_definitions` (migration 037). Reference these constants at call sites
 * instead of raw strings so typos are caught and renames are centralized.
 *
 * Naming convention (also enforced by DB CHECK + isValidFeatureKey):
 *  - snake_case only (lowercase, digits, underscores; start with a letter)
 *  - boolean capabilities: can_/is_/has_ prefix
 *  - numeric limits: *_limit or an explicit quantity noun
 *  - enum/string: plain noun, values constrained by feature_definitions.enum_options
 * Keys are immutable once created.
 */

const FEATURE_KEYS = Object.freeze({
  CAN_USE_BYOK: "can_use_byok",
  CAN_USE_MANAGED_AI: "can_use_managed_ai",
  CAN_BULK_APPLY: "can_bulk_apply",
  CAN_GENERATE_COVER_LETTER: "can_generate_cover_letter",
  MONTHLY_APPLICATION_LIMIT: "monthly_application_limit",
  MONTHLY_AI_CREDITS: "monthly_ai_credits",
  DAILY_AUTO_APPLY_LIMIT: "daily_auto_apply_limit",
  PRIORITY_PROCESSING: "priority_processing",
  SUPPORT_LEVEL: "support_level",
});

const FEATURE_TYPES = Object.freeze(["boolean", "number", "string", "enum", "json"]);

const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;

/** Validates a catalog key against the mandatory naming convention. */
function isValidFeatureKey(key) {
  return typeof key === "string" && SNAKE_CASE_RE.test(key);
}

/**
 * Default period for a metered numeric feature, derived from its key prefix.
 * Returns null for non-metered features.
 */
function periodTypeForFeatureKey(key) {
  if (typeof key !== "string") return null;
  if (key.startsWith("daily_")) return "daily";
  if (key.startsWith("weekly_")) return "weekly";
  if (key.startsWith("monthly_")) return "monthly";
  return null;
}

module.exports = {
  FEATURE_KEYS,
  FEATURE_TYPES,
  SNAKE_CASE_RE,
  isValidFeatureKey,
  periodTypeForFeatureKey,
};
