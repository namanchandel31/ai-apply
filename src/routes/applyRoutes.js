const express = require("express");
const router = express.Router();
const { processApplication } = require("../controllers/applyController");
const authMiddleware = require("../middlewares/authMiddleware");
const { applyRateLimit } = require("../middlewares/rateLimitMiddleware");

/**
 * @openapi
 * /api/apply:
 *   post:
 *     operationId: createApplication
 *     tags: [Applications]
 *     summary: Create a new job application
 *     description: |
 *       Links a parsed resume, job description, and email credential into an application
 *       record. The application is queued for email dispatch via `/api/send-application/:id`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplyRequest'
 *           example:
 *             jdId: "550e8400-e29b-41d4-a716-446655440002"
 *             resumeId: "550e8400-e29b-41d4-a716-446655440001"
 *             credentialId: "550e8400-e29b-41d4-a716-446655440003"
 *     responses:
 *       201:
 *         description: Application queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplyResponse'
 *             example:
 *               success: true
 *               applicationId: "550e8400-e29b-41d4-a716-446655440004"
 *               status: "queued"
 *       409:
 *         description: Duplicate application — an application for this JD already exists
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "DUPLICATE_APPLICATION"
 *                 message: "An application for this job description already exists"
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/", authMiddleware, applyRateLimit, processApplication);

module.exports = router;
