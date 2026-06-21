const { pool } = require("../db");

/**
 * Compute the period_start bucket (a DATE) for a given period type.
 * lifetime uses a fixed sentinel so all-time usage lands in one row.
 */
function computePeriodStart(periodType, now = new Date()) {
  const d = new Date(now);
  switch (periodType) {
    case "daily":
      return d.toISOString().slice(0, 10);
    case "weekly": {
      // ISO week start (Monday).
      const day = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - day);
      return d.toISOString().slice(0, 10);
    }
    case "monthly":
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    case "lifetime":
      return "1970-01-01";
    default:
      throw new Error(`Unknown period type: ${periodType}`);
  }
}

async function getUsage(userId, featureKey, periodType, client = pool) {
  const periodStart = computePeriodStart(periodType);
  const { rows } = await client.query(
    `SELECT usage_count FROM usage_counters
     WHERE user_id = $1 AND feature_key = $2 AND period_type = $3 AND period_start = $4
     LIMIT 1`,
    [userId, featureKey, periodType, periodStart]
  );
  return rows.length ? Number(rows[0].usage_count) : 0;
}

/** Atomically increments the current bucket and returns the new count. */
async function consume(userId, featureKey, periodType, n = 1, client = pool) {
  const periodStart = computePeriodStart(periodType);
  const { rows } = await client.query(
    `INSERT INTO usage_counters (user_id, feature_key, period_type, period_start, usage_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, feature_key, period_type, period_start) DO UPDATE SET
       usage_count = usage_counters.usage_count + EXCLUDED.usage_count,
       updated_at = NOW()
     RETURNING usage_count`,
    [userId, featureKey, periodType, periodStart, n]
  );
  return Number(rows[0].usage_count);
}

/**
 * Atomically increments only when the result stays within `limit`. Returns the new
 * count on success, or null when the increment would exceed the limit (no check-then-act
 * race — the guard lives in the single SQL statement).
 */
async function consumeIfWithinLimit(userId, featureKey, periodType, n, limit, client = pool) {
  const periodStart = computePeriodStart(periodType);
  const { rows } = await client.query(
    `INSERT INTO usage_counters (user_id, feature_key, period_type, period_start, usage_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, feature_key, period_type, period_start) DO UPDATE SET
       usage_count = usage_counters.usage_count + EXCLUDED.usage_count,
       updated_at = NOW()
     WHERE usage_counters.usage_count + EXCLUDED.usage_count <= $6
     RETURNING usage_count`,
    [userId, featureKey, periodType, periodStart, n, limit]
  );
  return rows.length ? Number(rows[0].usage_count) : null;
}

/**
 * Atomically decrements the current bucket, never going below zero. Used to release a
 * reservation when a reserved-then-charged action fails after the credit was taken, so
 * failed work doesn't permanently consume an allowance. Returns the resulting count.
 */
async function release(userId, featureKey, periodType, n = 1, client = pool) {
  const periodStart = computePeriodStart(periodType);
  const { rows } = await client.query(
    `UPDATE usage_counters
       SET usage_count = GREATEST(0, usage_count - $5), updated_at = NOW()
     WHERE user_id = $1 AND feature_key = $2 AND period_type = $3 AND period_start = $4
     RETURNING usage_count`,
    [userId, featureKey, periodType, periodStart, n]
  );
  return rows.length ? Number(rows[0].usage_count) : 0;
}

module.exports = { computePeriodStart, getUsage, consume, consumeIfWithinLimit, release };
