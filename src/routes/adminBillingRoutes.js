const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const adminGuard = require("../middlewares/adminGuard");
const c = require("../controllers/adminBillingController");

const router = express.Router();

// All admin billing/subscription endpoints are gated by adminGuard (404 for non-admins).
const admin = express.Router();
admin.use(supabaseAuthMiddleware, adminGuard);

// Settings
admin.get("/settings", c.getSettingsController);
admin.put("/settings", c.updateSettingsController);

// Feature catalog
admin.get("/features", c.listFeaturesController);
admin.post("/features", c.createFeatureController);
admin.patch("/features/:id", c.updateFeatureController);

// Plans
admin.get("/plans", c.listPlansController);
admin.post("/plans", c.createPlanController);
admin.post("/plans/config", c.createPlanConfigController);
admin.get("/plans/compare", c.comparePlansController);
admin.patch("/plans/:id", c.updatePlanController);
admin.put("/plans/:id/config", c.savePlanConfigController);
admin.post("/plans/:id/duplicate", c.duplicatePlanController);
admin.post("/plans/:id/price-points", c.createPricePointController);
admin.patch("/plans/:id/price-points/:pricePointId", c.updatePricePointController);
admin.put("/plans/:id/features", c.replaceFeaturesController);
admin.get("/plans/:id/entitlements", c.getEntitlementsController);
admin.put("/plans/:id/entitlements", c.updateEntitlementsController);
admin.put("/plans/:id/onboarding", c.updateOnboardingController);

// Campaigns
admin.get("/campaigns", c.listCampaignsController);
admin.post("/campaigns", c.createCampaignController);
admin.patch("/campaigns/:id", c.updateCampaignController);

// Subscriptions
admin.get("/subscriptions", c.listSubscriptionsController);
admin.post("/subscriptions/:userId/:action", c.subscriptionActionController);

// Billing
admin.get("/payments", c.listPaymentsController);

router.use("/admin", admin);

module.exports = router;
