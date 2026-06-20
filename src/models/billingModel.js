const { pool } = require("../db");

async function createPaymentOrder({
  userId,
  planId,
  amountPaise,
  currency,
  razorpayOrderId,
}) {
  const { rows } = await pool.query(
    `INSERT INTO user_plan_payments
      (user_id, plan_id, amount_paise, currency, razorpay_order_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (razorpay_order_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       amount_paise = EXCLUDED.amount_paise,
       currency = EXCLUDED.currency
     RETURNING *`,
    [userId, planId, amountPaise, currency, razorpayOrderId]
  );
  return rows[0] || null;
}

async function findOrderById(razorpayOrderId) {
  const { rows } = await pool.query(
    `SELECT * FROM user_plan_payments WHERE razorpay_order_id = $1 LIMIT 1`,
    [razorpayOrderId]
  );
  return rows[0] || null;
}

async function markPaymentVerified({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const { rows } = await pool.query(
    `UPDATE user_plan_payments
     SET razorpay_payment_id = $2,
         razorpay_signature = $3,
         status = 'verified',
         verified_at = NOW()
     WHERE razorpay_order_id = $1
     RETURNING *`,
    [razorpayOrderId, razorpayPaymentId, razorpaySignature]
  );
  return rows[0] || null;
}

module.exports = {
  createPaymentOrder,
  findOrderById,
  markPaymentVerified,
};
