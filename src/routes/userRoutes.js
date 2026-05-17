const express = require('express');
const { getUserDefaultsController, setUserDefaultsController } = require('../controllers/userDefaultsController');
const { authenticateToken } = require('../middlewares/auth');

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
router.get('/user/defaults', authenticateToken, getUserDefaultsController);

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
router.put('/user/defaults', authenticateToken, setUserDefaultsController);

module.exports = router;
