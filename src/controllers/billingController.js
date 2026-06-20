const crypto = require("crypto");
const Razorpay = require("razorpay");
const config = require("../config");
const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError, logInfo } = require("../utils/logger");
const { sendError } = require("../utils/httpErrorResponse");
const {
  createPaymentOrder,
  findOrderById,
  markPaymentVerified,
} = require("../models/billingModel");
const { setUserSubscriptionActive } = require("../models/userModel");
const { buildUserMeResponse } = require("../services/userMeService");

let razorpayClient = null;

function getPlan(planId) {
  return config.billing.plans[planId] ?? null;
}

function getRazorpayClient() {
  if (!config.billing.isEnabled) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.billing.razorpayKeyId,
      key_secret: config.billing.razorpayKeySecret,
    });
  }
  return razorpayClient;
}

function hasValidSignature({ orderId, paymentId, signature }) {
  if (!config.billing.razorpayKeySecret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", config.billing.razorpayKeySecret)
    .update(payload)
    .digest("hex");
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

const createBillingOrderController = async (req, res) => {
  const userId = req.user.id;
  const { planId } = req.body || {};
  const plan = getPlan(planId);
  if (!plan) {
    return error(res, 400, "Invalid plan selected", ERROR_CODES.BAD_REQUEST);
  }

  const client = getRazorpayClient();
  if (!client) {
    return sendError(res, {
      status: 503,
      code: "BILLING_UNAVAILABLE",
      message: "Billing is not configured",
      retryable: false,
    });
  }

  try {
    const order = await client.orders.create({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt: `onetap_${userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId,
        planId: plan.id,
      },
    });

    await createPaymentOrder({
      userId,
      planId: plan.id,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      razorpayOrderId: order.id,
    });

    logInfo("BILLING_ORDER_CREATED", {
      userId,
      reqId: req.requestId,
      planId: plan.id,
      orderId: order.id,
    });

    return ok(res, {
      orderId: order.id,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      keyId: config.billing.razorpayKeyId,
      plan: {
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
      },
    });
  } catch (err) {
    logError("BILLING_CREATE_ORDER_ERROR", err, {
      userId,
      reqId: req.requestId,
      planId: plan.id,
    });
    return error(res, 500, "Failed to create payment order", ERROR_CODES.INTERNAL_ERROR);
  }
};

const verifyBillingPaymentController = async (req, res) => {
  const userId = req.user.id;
  const {
    planId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body || {};

  const plan = getPlan(planId);
  if (!plan || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return error(res, 400, "Invalid payment verification payload", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const orderRecord = await findOrderById(razorpayOrderId);
    if (!orderRecord || orderRecord.user_id !== userId) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Payment order not found",
        retryable: false,
      });
    }

    if (
      !hasValidSignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      })
    ) {
      return sendError(res, {
        status: 400,
        code: "INVALID_PAYMENT_SIGNATURE",
        message: "Payment verification failed",
        retryable: false,
      });
    }

    await markPaymentVerified({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    await setUserSubscriptionActive(userId, {
      subscriptionTier: plan.tier,
      planId: plan.id,
      razorpayOrderId,
      razorpayPaymentId,
    });

    const me = await buildUserMeResponse(userId);

    logInfo("BILLING_PAYMENT_VERIFIED", {
      userId,
      reqId: req.requestId,
      planId: plan.id,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
    });

    return ok(res, { user: me });
  } catch (err) {
    logError("BILLING_VERIFY_PAYMENT_ERROR", err, {
      userId,
      reqId: req.requestId,
      planId,
      orderId: razorpayOrderId,
    });
    return error(res, 500, "Failed to verify payment", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  createBillingOrderController,
  verifyBillingPaymentController,
};
