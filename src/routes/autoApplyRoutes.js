const express = require('express');
const { autoApplyController } = require('../controllers/autoApplyController');
const supabaseAuthMiddleware = require('../middlewares/supabaseAuthMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/auto-apply:
 *   post:
 *     tags:
 *       - AutoApply
 *     summary: One-paste automated job application
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobDescription
 *             properties:
 *               jobDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application created, needs manual review (no recruiter email)
 *       202:
 *         description: Application queued for sending
 *       400:
 *         description: Validation / defaults not configured
 *       409:
 *         description: Duplicate application within 24h
 *       500:
 *         description: Internal error
 */
router.post('/auto-apply', supabaseAuthMiddleware, autoApplyController);

module.exports = router;
