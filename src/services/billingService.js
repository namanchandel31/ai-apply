const crypto = require("crypto");
const config = require("../config");

/**
 * Thin wrapper around Razorpay. Phase 1 = Orders only. Designed so a future
 * Subscriptions adapter can slot in behind the same interface.
 */

let razorpayClient = null;

function isEnabled() {
  return Boolean(config.billing.isEnabled);
}

function getKeyId() {
  return config.billing.razorpayKeyId;
}

function getClient() {
  if (!isEnabled()) return null;
  if (!razorpayClient) {
    const Razorpay = require("razorpay");
    razorpayClient = new Razorpay({
      key_id: config.billing.razorpayKeyId,
      key_secret: config.billing.razorpayKeySecret,
    });
  }
  return razorpayClient;
}

async function createOrder({ amountPaise, currency = "INR", userId, notes = {} }) {
  const client = getClient();
  if (!client) {
    const err = new Error("Billing is not configured");
    err.code = "BILLING_UNAVAILABLE";
    throw err;
  }
  return client.orders.create({
    amount: amountPaise,
    currency,
    receipt: `onetap_${String(userId).slice(0, 8)}_${Date.now()}`,
    notes: { userId, ...notes },
  });
}

/** Razorpay checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
function hasValidPaymentSignature({ orderId, paymentId, signature }) {
  if (!config.billing.razorpayKeySecret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", config.billing.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Webhook signature verification (X-Razorpay-Signature over the raw body). */
function hasValidWebhookSignature(rawBody, signature) {
  const secret = config.billing.razorpayWebhookSecret;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isEnabled,
  getKeyId,
  getClient,
  createOrder,
  hasValidPaymentSignature,
  hasValidWebhookSignature,
};
