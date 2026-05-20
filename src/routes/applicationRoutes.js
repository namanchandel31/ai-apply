const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { applyRateLimit } = require("../middlewares/rateLimitMiddleware");
const {
  listApplicationsController,
  getApplicationController,
  getApplicationStatusController,
  continueApplicationController,
  retryApplicationController,
  cancelApplicationController,
  getApplicationJobController,
} = require("../controllers/applicationController");

router.get("/applications", authMiddleware, listApplicationsController);
router.get("/applications/:id", authMiddleware, getApplicationController);
router.get("/applications/:id/status", authMiddleware, getApplicationStatusController);
router.post("/applications/:id/continue", authMiddleware, applyRateLimit, continueApplicationController);
router.post("/applications/:id/retry", authMiddleware, applyRateLimit, retryApplicationController);
router.post("/applications/:id/cancel", authMiddleware, cancelApplicationController);
router.get("/application-jobs/:id", authMiddleware, getApplicationJobController);

module.exports = router;
