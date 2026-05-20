const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { getActiveOrchestrationController } = require("../controllers/orchestrationController");

const router = express.Router();

router.get("/orchestration/active", authMiddleware, getActiveOrchestrationController);

module.exports = router;
