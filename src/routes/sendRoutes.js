const express = require('express');
const { sendApplicationController } = require('../controllers/sendController');
const supabaseAuthMiddleware = require('../middlewares/supabaseAuthMiddleware');
const { applyRateLimit } = require('../middlewares/rateLimitMiddleware');
const requireNotBlocked = require('../middlewares/requireNotBlocked');

const router = express.Router();

/**
 * @openapi
 * /api/send-application/{applicationId}:
 *   post:
 *     operationId: sendApplication
 *     tags: [Applications]
 *     summary: Dispatch the application email
 *     description: |
 *       Triggers the email dispatch pipeline for a queued application.
 *       State transitions: `queued` → `processing` → `sent` | `failed`.
 *
 *       This endpoint is **idempotent for failed retries** — re-triggering a `failed`
 *       application will re-attempt dispatch. Sending an already `sent` application
 *       returns a 409 conflict.
 *     parameters:
 *       - name: applicationId
 *         in: path
 *         required: true
 *         description: UUID of the application to send
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440004"
 *     responses:
 *       200:
 *         description: Email dispatched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendResponse'
 *             example:
 *               success: true
 *               applicationId: "550e8400-e29b-41d4-a716-446655440004"
 *               status: "sent"
 *       409:
 *         description: Application already sent — cannot re-dispatch
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "ALREADY_SENT"
 *                 message: "This application has already been dispatched"
 *       404:
 *         description: Application not found
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "NOT_FOUND"
 *                 message: "Application not found"
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/send-application/:applicationId', supabaseAuthMiddleware, requireNotBlocked, applyRateLimit, sendApplicationController);

module.exports = router;
