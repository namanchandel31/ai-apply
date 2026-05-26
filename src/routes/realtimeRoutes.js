const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const { streamRealtimeController } = require("../controllers/realtimeController");

const router = express.Router();

router.get("/realtime/stream", supabaseAuthMiddleware, streamRealtimeController);

module.exports = router;
