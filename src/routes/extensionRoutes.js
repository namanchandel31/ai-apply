const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const adminGuard = require("../middlewares/adminGuard");
const {
  getDetectionConfigController,
  putAdminDetectionConfigController,
} = require("../controllers/extensionDetectionConfigController");
const {
  postConnectInitController,
  postConnectExchangeController,
} = require("../controllers/extensionConnectController");
const { getExtensionPopupStatusController } = require("../controllers/extensionPopupStatusController");

const router = express.Router();

router.post(
  "/extension/connect/init",
  supabaseAuthMiddleware,
  postConnectInitController
);
router.post("/extension/connect/exchange", postConnectExchangeController);

router.get(
  "/extension/detection-config",
  supabaseAuthMiddleware,
  getDetectionConfigController
);
router.get(
  "/extension/popup-status",
  supabaseAuthMiddleware,
  getExtensionPopupStatusController
);

const adminRouter = express.Router();
adminRouter.use(supabaseAuthMiddleware, adminGuard);
adminRouter.put("/extension-detection-config", putAdminDetectionConfigController);

router.use("/admin", adminRouter);

module.exports = router;
