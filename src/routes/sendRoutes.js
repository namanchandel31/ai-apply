const express = require('express');
const { sendApplicationController } = require('../controllers/sendController');
const authMiddleware = require('../middlewares/authMiddleware');
const { sendRateLimit } = require('../middlewares/rateLimitMiddleware');

const router = express.Router();

router.post('/send-application/:applicationId', authMiddleware, sendRateLimit, sendApplicationController);

module.exports = router;
