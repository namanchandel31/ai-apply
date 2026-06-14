const express = require("express");
const router = express.Router();
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
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
const {
  patchApplicationTrackerStatusController,
  getTrackerStatusSummaryController,
} = require("../controllers/trackerStatusController");

router.get("/applications", supabaseAuthMiddleware, listApplicationsController);
router.get(
  "/applications/tracker-status-summary",
  supabaseAuthMiddleware,
  getTrackerStatusSummaryController
);
router.get("/applications/:id", supabaseAuthMiddleware, getApplicationController);
router.get("/applications/:id/status", supabaseAuthMiddleware, getApplicationStatusController);
router.post("/applications/:id/continue", supabaseAuthMiddleware, applyRateLimit, continueApplicationController);
router.post("/applications/:id/retry", supabaseAuthMiddleware, applyRateLimit, retryApplicationController);
router.post("/applications/:id/cancel", supabaseAuthMiddleware, cancelApplicationController);
router.patch("/applications/:id/tracker-status", supabaseAuthMiddleware, patchApplicationTrackerStatusController);
router.get("/application-jobs/:id", supabaseAuthMiddleware, getApplicationJobController);

module.exports = router;
