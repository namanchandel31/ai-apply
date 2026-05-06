const express = require('express');
const uploadMiddleware = require('../middlewares/upload');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadResumeController } = require('../controllers/resumeController');

const router = express.Router();

router.post('/upload-resume', authMiddleware, uploadMiddleware, uploadResumeController);

module.exports = router;
