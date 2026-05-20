export const APPLICATION_POLL_MS = 3000;

/** Slower fallback when SSE is connected (safety net only). */
export const APPLICATION_POLL_SSE_FALLBACK_MS = 30_000;

/** Source of truth for client-side poll budget (3 minutes). */
export const APPLICATION_MAX_POLL_DURATION_MS = 180_000;

export const APPLICATION_MAX_POLL_ATTEMPTS = Math.floor(
  APPLICATION_MAX_POLL_DURATION_MS / APPLICATION_POLL_MS
);

export const MAX_CONSECUTIVE_POLL_ERRORS = 3;

/** Per-app error backoff: base * 2^n, capped. */
export const POLL_BACKOFF_BASE_MS = APPLICATION_POLL_MS;
export const POLL_BACKOFF_MAX_MS = 30_000;

/** When 429 has no Retry-After header. */
export const POLL_RATE_LIMIT_DEFAULT_MS = 60_000;

/** Max parallel status fetches per tick. */
export const STATUS_POLL_CONCURRENCY = 3;
