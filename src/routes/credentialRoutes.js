const express = require('express');
const { saveEmailCredentialsController } = require('../controllers/credentialController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/save-email-credentials', authMiddleware, saveEmailCredentialsController);

module.exports = router;
