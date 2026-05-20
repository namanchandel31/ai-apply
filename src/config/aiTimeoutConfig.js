/**
 * AI operation timeouts — separate policies by operation type.
 * Override via environment variables in production.
 */

const parseIntEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Credential save / test-connection health probes (OpenRouter, free-tier, large models). */
const HEALTH_CHECK_TIMEOUT_MS = parseIntEnv("HEALTH_CHECK_TIMEOUT_MS", 20_000);

/** Local provider reachability (tags/models list only). */
const LOCAL_HEALTH_CHECK_TIMEOUT_MS = parseIntEnv("LOCAL_HEALTH_CHECK_TIMEOUT_MS", 5_000);

/** Runtime structured parse / generation (gateway tasks). */
const RUNTIME_GENERATION_TIMEOUT_MS = parseIntEnv(
  "PARSE_LLM_TIMEOUT_MS",
  parseIntEnv("LLM_TIMEOUT_MS", 45_000)
);

/** Runtime email generation. */
const RUNTIME_EMAIL_TIMEOUT_MS = parseIntEnv("EMAIL_LLM_TIMEOUT_MS", 10_000);

/** Health check result cache TTL (not request timeout). */
const HEALTH_CHECK_CACHE_TTL_MS = parseIntEnv("HEALTH_CHECK_CACHE_TTL_MS", 60_000);

module.exports = {
  HEALTH_CHECK_TIMEOUT_MS,
  LOCAL_HEALTH_CHECK_TIMEOUT_MS,
  RUNTIME_GENERATION_TIMEOUT_MS,
  RUNTIME_EMAIL_TIMEOUT_MS,
  HEALTH_CHECK_CACHE_TTL_MS,
};
