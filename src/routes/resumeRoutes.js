const express = require('express');
const rateLimit = require('express-rate-limit');
const uploadMiddleware = require('../middlewares/upload');
const { uploadResumeController } = require('../controllers/resumeController');

const router = express.Router();

// Rate limit: 20 requests per minute per IP, scoped to upload-resume only
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

router.post('/upload-resume', uploadRateLimiter, uploadMiddleware, uploadResumeController);

module.exports = router;
