const express = require('express');
const { getUserDefaultsController, setUserDefaultsController } = require('../controllers/userDefaultsController');
const { getSetupStatusController, getMeController } = require('../controllers/userController');
const supabaseAuthMiddleware = require('../middlewares/supabaseAuthMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/user/me:
 *   get:
 *     tags:
 *       - User
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 */
router.get('/user/me', supabaseAuthMiddleware, getMeController);

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
router.get('/user/defaults', supabaseAuthMiddleware, getUserDefaultsController);

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
router.put('/user/defaults', supabaseAuthMiddleware, setUserDefaultsController);

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
router.get('/user/setup-status', supabaseAuthMiddleware, getSetupStatusController);

module.exports = router;
