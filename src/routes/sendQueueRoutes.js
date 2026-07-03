const express = require("express");
const router = express.Router();
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const {
  getSendQueueSummaryController,
  pauseSendQueueController,
  resumeSendQueueController,
  sendApplicationNowController,
} = require("../controllers/sendQueueController");

router.get("/send-queue/summary", supabaseAuthMiddleware, getSendQueueSummaryController);
router.post("/send-queue/pause", supabaseAuthMiddleware, pauseSendQueueController);
router.post("/send-queue/resume", supabaseAuthMiddleware, resumeSendQueueController);
router.post("/applications/:id/send-now", supabaseAuthMiddleware, sendApplicationNowController);

module.exports = router;
