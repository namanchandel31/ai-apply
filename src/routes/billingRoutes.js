const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const {
  createCheckoutController,
  verifyBillingPaymentController,
  getBillingOrdersController,
} = require("../controllers/billingController");
const {
  getSubscriptionStatusController,
  getUsageController,
  compareForUserController,
  claimTrialController,
  cancelSubscriptionController,
} = require("../controllers/subscriptionController");
const {
  getPricingController,
  getActiveCampaignsController,
} = require("../controllers/pricingController");

const router = express.Router();

// Public pricing (no auth; campaign personalization only when authenticated elsewhere).
router.get("/pricing", getPricingController);

// Authenticated subscription + checkout endpoints.
router.get("/campaigns/active", supabaseAuthMiddleware, getActiveCampaignsController);
router.post("/checkout/create", supabaseAuthMiddleware, createCheckoutController);
router.post("/billing/verify-payment", supabaseAuthMiddleware, verifyBillingPaymentController);
router.get("/billing/orders", supabaseAuthMiddleware, getBillingOrdersController);
router.post("/trials/claim", supabaseAuthMiddleware, claimTrialController);
router.get("/subscription/status", supabaseAuthMiddleware, getSubscriptionStatusController);
router.post("/subscription/cancel", supabaseAuthMiddleware, cancelSubscriptionController);
router.get("/usage", supabaseAuthMiddleware, getUsageController);
router.get("/plans/compare", supabaseAuthMiddleware, compareForUserController);

module.exports = router;
