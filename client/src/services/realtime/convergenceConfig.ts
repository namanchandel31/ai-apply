/** Leader-tab maximum time a row may remain stale before heal hierarchy runs. */
export const MAX_STALE_CONVERGENCE_MS = 90_000;

/** Stale watchdog interval on leader tab. */
export const STALE_WATCHDOG_INTERVAL_MS = 30_000;

/** Partial row TTL before forced heal. */
export const PARTIAL_ROW_TTL_MS = 60_000;
