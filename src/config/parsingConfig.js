/**
 * Centralized parsing / LLM timeout configuration.
 * Override via environment variables in production.
 */

const parseIntEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  /** OpenAI model for resume/JD structured extraction */
  LLM_MODEL: process.env.PARSE_LLM_MODEL || "gpt-4.1-mini",

  /** Per-request OpenAI call timeout (ms) */
  LLM_TIMEOUT_MS: parseIntEnv("PARSE_LLM_TIMEOUT_MS", 45_000),

  /** Max LLM retry attempts (RetryableError only) */
  LLM_MAX_ATTEMPTS: parseIntEnv("PARSE_LLM_MAX_ATTEMPTS", 3),

  /** Base backoff between LLM retries (ms) */
  LLM_RETRY_BASE_DELAY_MS: parseIntEnv("PARSE_LLM_RETRY_BASE_DELAY_MS", 750),

  /** Max characters sent to the model after sanitization */
  MAX_LLM_INPUT_CHARS: parseIntEnv("PARSE_MAX_INPUT_CHARS", 15_000),

  /** Max characters stored in Postgres text columns */
  MAX_STORAGE_TEXT_CHARS: parseIntEnv("PARSE_MAX_STORAGE_CHARS", 15_000),

  /** Client poll interval hint (ms) — documented for API consumers */
  JOB_POLL_INTERVAL_MS: parseIntEnv("RESUME_JOB_POLL_INTERVAL_MS", 2_000),

  /** In-memory job registry TTL (ms) */
  JOB_REGISTRY_TTL_MS: parseIntEnv("RESUME_JOB_REGISTRY_TTL_MS", 60 * 60 * 1000),
};
