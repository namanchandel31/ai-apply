const express = require("express");
const router = express.Router();
const { processApplication } = require("../controllers/applyController");
const authMiddleware = require("../middlewares/authMiddleware");
const { applyRateLimit } = require("../middlewares/rateLimitMiddleware");

router.post("/", authMiddleware, applyRateLimit, processApplication);

module.exports = router;
