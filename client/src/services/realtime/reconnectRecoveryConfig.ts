/** Reconnect recovery tier thresholds (pragmatic fixed policy). */

export const RECOVERY_TIER1_MAX_MS = 60_000;
export const RECOVERY_TIER2_MAX_MS = 15 * 60_000;
export const TIER2_MAX_AFFECTED_APPS = 50;
export const TIER2_MAX_CONCURRENT_FETCHES = 5;
export const TIER2_FETCH_RATE_LIMIT_MS = 200;

export const CATASTROPHIC_MAX_ATTEMPTS = 3;
export const CATASTROPHIC_COOLDOWN_MS = 5 * 60_000;

export const EVENT_BATCH_FLUSH_MS = 75;

export type RecoveryTier = 1 | 2 | 3;

export function selectRecoveryTier(disconnectMs: number): RecoveryTier {
  if (disconnectMs < RECOVERY_TIER1_MAX_MS) return 1;
  if (disconnectMs < RECOVERY_TIER2_MAX_MS) return 2;
  return 3;
}
