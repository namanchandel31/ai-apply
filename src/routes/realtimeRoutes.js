const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { streamRealtimeController } = require("../controllers/realtimeController");

const router = express.Router();

router.get("/realtime/stream", authMiddleware, streamRealtimeController);

module.exports = router;
