const express = require('express');
const { uploadJDController } = require('../controllers/jdController');
const crypto = require('crypto');

const router = express.Router();

// Generate request ID for correlation, similar to uploadMiddleware
const attachRequestId = (req, res, next) => {
  req.requestId = crypto.randomBytes(6).toString('hex');
  next();
};

router.post('/upload-jd', attachRequestId, uploadJDController);

module.exports = router;
