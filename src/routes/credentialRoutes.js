const express = require('express');
const { saveEmailCredentialsController } = require('../controllers/credentialController');

const router = express.Router();

router.post('/save-email-credentials', saveEmailCredentialsController);

module.exports = router;
