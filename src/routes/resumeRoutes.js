const express = require('express');
const uploadMiddleware = require('../middlewares/upload');
const { uploadResumeController } = require('../controllers/resumeController');

const router = express.Router();

router.post('/upload-resume', uploadMiddleware, uploadResumeController);

module.exports = router;
