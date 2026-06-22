const { pool } = require("../db");

// ----- payment_attempts -----
async function createAttempt(
  { userId, planId, pricePointId, campaignId = null, intendedAmountPaise, discountAmountPaise = 0, razorpayOrderId },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO payment_attempts
      (user_id, plan_id, price_point_id, campaign_id, intended_amount_paise, discount_amount_paise, razorpay_order_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 hour')
     RETURNING *`,
    [userId, planId, pricePointId, campaignId, intendedAmountPaise, discountAmountPaise, razorpayOrderId]
  );
  return rows[0] || null;
}

async function getAttemptByOrderId(razorpayOrderId, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM payment_attempts WHERE razorpay_order_id = $1 LIMIT 1`,
    [razorpayOrderId]
  );
  return rows[0] || null;
}

async function setAttemptStatus(id, status, client = pool) {
  await client.query(`UPDATE payment_attempts SET status = $2 WHERE id = $1`, [id, status]);
}

async function listStalePendingAttempts({ olderThanMinutes = 15, limit = 100 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM payment_attempts
     WHERE status = 'pending' AND created_at < NOW() - ($1 || ' minutes')::interval
     ORDER BY created_at LIMIT $2`,
    [String(olderThanMinutes), limit]
  );
  return rows;
}

// ----- payments -----
async function getPaymentByRazorpayPaymentId(razorpayPaymentId, client = pool) {
  const { rows } = await client.query(
    `SELECT * FROM payments WHERE razorpay_payment_id = $1 LIMIT 1`,
    [razorpayPaymentId]
  );
  return rows[0] || null;
}

async function createCapturedPayment(
  { userId, subscriptionId = null, planId, pricePointId, razorpayOrderId, razorpayPaymentId, amountPaise, currency = "INR", campaignId = null, discountAmountPaise = 0 },
  client = pool
) {
  const { rows } = await client.query(
    `INSERT INTO payments
      (user_id, subscription_id, plan_id, price_point_id, razorpay_order_id, razorpay_payment_id,
       amount_paise, currency, status, campaign_id, discount_amount_paise, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'captured', $9, $10, NOW())
     ON CONFLICT (razorpay_payment_id) DO NOTHING
     RETURNING *`,
    [userId, subscriptionId, planId, pricePointId, razorpayOrderId, razorpayPaymentId, amountPaise, currency, campaignId, discountAmountPaise]
  );
  return rows[0] || null;
}

async function listPayments({ limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM payments ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function listPaymentsForUser(userId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT p.id, p.amount_paise, p.currency, p.status, p.razorpay_order_id,
            p.razorpay_payment_id, p.captured_at, p.created_at,
            pl.slug AS plan_slug, pl.display_name AS plan_display_name
     FROM payments p
     LEFT JOIN plans pl ON pl.id = p.plan_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows.map((row) => ({
    id: row.id,
    planSlug: row.plan_slug,
    planDisplayName: row.plan_display_name,
    amountPaise: row.amount_paise,
    currency: row.currency,
    status: row.status,
    razorpayOrderId: row.razorpay_order_id,
    razorpayPaymentId: row.razorpay_payment_id,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  }));
}

// ----- billing_events (webhook idempotency) -----
async function recordBillingEvent({ razorpayEventId, eventType, payload }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO billing_events (razorpay_event_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (razorpay_event_id) DO NOTHING
     RETURNING *`,
    [razorpayEventId, eventType, JSON.stringify(payload ?? {})]
  );
  return rows[0] || null; // null => already seen (duplicate)
}

async function markBillingEventProcessed(razorpayEventId, { status = "processed", error = null } = {}, client = pool) {
  await client.query(
    `UPDATE billing_events SET processing_status = $2, error = $3, processed_at = NOW()
     WHERE razorpay_event_id = $1`,
    [razorpayEventId, status, error]
  );
}

module.exports = {
  createAttempt,
  getAttemptByOrderId,
  setAttemptStatus,
  listStalePendingAttempts,
  getPaymentByRazorpayPaymentId,
  createCapturedPayment,
  listPayments,
  listPaymentsForUser,
  recordBillingEvent,
  markBillingEventProcessed,
};
