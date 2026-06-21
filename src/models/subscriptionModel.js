const { pool } = require("../db");

const COLUMNS = `id, user_id, plan_id, price_point_id, status, source,
                 access_starts_at, access_ends_at, campaign_id, last_payment_id,
                 cancel_at_period_end, razorpay_subscription_id,
                 current_period_start, current_period_end, grace_until,
                 created_at, updated_at`;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    pricePointId: row.price_point_id,
    status: row.status,
    source: row.source,
    accessStartsAt: row.access_starts_at,
    accessEndsAt: row.access_ends_at,
    campaignId: row.campaign_id,
    lastPaymentId: row.last_payment_id,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The single live (trialing/active) subscription for a user, if any. */
async function getLiveSubscription(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM user_subscriptions
     WHERE user_id = $1 AND status IN ('trialing', 'active')
     ORDER BY access_ends_at DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  return mapRow(rows[0]);
}

async function getById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM user_subscriptions WHERE id = $1 LIMIT 1`, [id]
  );
  return mapRow(rows[0]);
}

async function createSubscription(
  { userId, planId, pricePointId = null, status, source, accessStartsAt = null, accessEndsAt = null, campaignId = null, lastPaymentId = null },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO user_subscriptions
       (user_id, plan_id, price_point_id, status, source, access_starts_at, access_ends_at, campaign_id, last_payment_id)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7, $8, $9)
     RETURNING ${COLUMNS}`,
    [userId, planId, pricePointId, status, source, accessStartsAt, accessEndsAt, campaignId, lastPaymentId]
  );
  return mapRow(rows[0]);
}

async function updateSubscription(id, fields, client = pool) {
  const map = {
    planId: "plan_id",
    pricePointId: "price_point_id",
    status: "status",
    accessEndsAt: "access_ends_at",
    campaignId: "campaign_id",
    lastPaymentId: "last_payment_id",
    cancelAtPeriodEnd: "cancel_at_period_end",
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] === undefined) continue;
    sets.push(`${col} = $${i}`);
    values.push(fields[k]);
    i += 1;
  }
  if (!sets.length) return getById(id, client);
  sets.push("updated_at = NOW()");
  values.push(id);
  const { rows } = await client.query(
    `UPDATE user_subscriptions SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${COLUMNS}`,
    values
  );
  return mapRow(rows[0]);
}

/** Expire any live subscription whose access window has elapsed. Returns count. */
async function expireElapsed(client = pool) {
  const { rowCount } = await client.query(
    `UPDATE user_subscriptions
     SET status = 'expired', updated_at = NOW()
     WHERE status IN ('trialing', 'active')
       AND access_ends_at IS NOT NULL
       AND access_ends_at < NOW()`
  );
  return rowCount;
}

async function listAll({ limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM user_subscriptions
     ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map(mapRow);
}

module.exports = {
  getLiveSubscription,
  getById,
  createSubscription,
  updateSubscription,
  expireElapsed,
  listAll,
};
