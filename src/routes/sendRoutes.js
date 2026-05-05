const express = require('express');
const { sendApplicationController } = require('../controllers/sendController');

const router = express.Router();

// Rate limiter: Map<userId, timestamp>
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 3000; // 3 seconds

router.post('/send-application/:applicationId', async (req, res, next) => {
  const userId = req.body.userId;
  const now = Date.now();
  const lastSend = rateLimitMap.get(userId);

  if (lastSend && (now - lastSend) < RATE_LIMIT_MS) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded'
    });
  }

  // Overwrite the timestamp
  rateLimitMap.set(userId, now);

  next();
}, sendApplicationController);

module.exports = router;
