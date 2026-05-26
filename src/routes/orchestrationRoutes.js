const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const { getActiveOrchestrationController } = require("../controllers/orchestrationController");

const router = express.Router();

router.get("/orchestration/active", supabaseAuthMiddleware, getActiveOrchestrationController);

module.exports = router;
