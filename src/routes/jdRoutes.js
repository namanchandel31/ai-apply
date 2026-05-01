const express = require('express');
const rateLimit = require('express-rate-limit');
const { uploadJDController } = require('../controllers/jdController');
const crypto = require('crypto');

const router = express.Router();

// Generate request ID for correlation, similar to uploadMiddleware
const attachRequestId = (req, res, next) => {
  req.requestId = crypto.randomBytes(6).toString('hex');
  next();
};

// Rate limit: 20 requests per minute per IP
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});

router.post('/upload-jd', attachRequestId, uploadRateLimiter, uploadJDController);

module.exports = router;
