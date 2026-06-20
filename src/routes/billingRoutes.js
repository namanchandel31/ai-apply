const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const {
  createBillingOrderController,
  verifyBillingPaymentController,
} = require("../controllers/billingController");

const router = express.Router();

router.post("/billing/create-order", supabaseAuthMiddleware, createBillingOrderController);
router.post("/billing/verify-payment", supabaseAuthMiddleware, verifyBillingPaymentController);

module.exports = router;
