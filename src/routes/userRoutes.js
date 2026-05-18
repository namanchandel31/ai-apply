const express = require('express');
const { getUserDefaultsController, setUserDefaultsController } = require('../controllers/userDefaultsController');
const { getSetupStatusController } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/user/defaults:
 *   get:
 *     tags:
 *       - User
 *     summary: Get user defaults
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User defaults fetched
 */
router.get('/user/defaults', authMiddleware, getUserDefaultsController);

/**
 * @openapi
 * /api/user/defaults:
 *   put:
 *     tags:
 *       - User
 *     summary: Set user defaults
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultResumeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User defaults updated
 */
router.put('/user/defaults', authMiddleware, setUserDefaultsController);

/**
 * @openapi
 * /api/user/setup-status:
 *   get:
 *     tags:
 *       - User
 *     summary: Get user setup status (hasResume, hasEmailSetup)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Setup status returned successfully
 */
router.get('/user/setup-status', authMiddleware, getSetupStatusController);

module.exports = router;
