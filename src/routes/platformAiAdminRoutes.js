const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const adminGuard = require("../middlewares/adminGuard");
const platformAi = require("../controllers/platformAiAdminController");
const aiCost = require("../controllers/aiCostAdminController");
const adminUsers = require("../controllers/adminUsersController");
const referrals = require("../controllers/referralController");

const router = express.Router();
const admin = express.Router();
admin.use(supabaseAuthMiddleware, adminGuard);

admin.get("/platform-ai", platformAi.listPlatformAiConfigController);
admin.put("/platform-ai/config", platformAi.upsertGlobalConfigController);
admin.post("/platform-ai/credentials", platformAi.createPlatformCredentialController);
admin.patch("/platform-ai/credentials/:id", platformAi.updatePlatformCredentialController);
admin.delete("/platform-ai/credentials/:id", platformAi.deletePlatformCredentialController);
admin.get("/ai-cost", aiCost.getAiCostMetricsController);
admin.get("/users", adminUsers.listAdminUsersController);
admin.post("/users/:userId/block", adminUsers.blockUserController);
admin.post("/users/:userId/grant-applications", adminUsers.grantApplicationsController);
admin.get("/referrals", referrals.getAdminReferralStatsController);
admin.put("/referrals/settings", referrals.updateReferralSettingsController);

router.get("/referrals/summary", supabaseAuthMiddleware, referrals.getReferralSummaryController);
router.get("/referrals", supabaseAuthMiddleware, referrals.getReferralListController);
router.post("/referrals/attach", supabaseAuthMiddleware, referrals.attachReferralController);

router.use("/admin", admin);

module.exports = router;
