const express = require('express');
const { uploadJDController } = require('../controllers/jdController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/upload-jd:
 *   post:
 *     operationId: uploadJD
 *     tags: [Upload]
 *     summary: Submit and parse a job description
 *     description: |
 *       Accepts raw job description text. The LLM pipeline extracts structured
 *       fields (job title, company, skills, location, job type, contact info).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Raw job description text
 *                 example: "We are hiring a Senior Node.js Engineer at Acme Corp in San Francisco (Remote). Skills required: Node.js, PostgreSQL, Docker. Contact hr@acme.com."
 *     responses:
 *       200:
 *         description: Job description parsed and stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JDUploadResponse'
 *             example:
 *               success: true
 *               data:
 *                 jdId: "550e8400-e29b-41d4-a716-446655440002"
 *                 parsedData:
 *                   job_title: "Senior Node.js Engineer"
 *                   company_name: "Acme Corp"
 *                   location: "San Francisco"
 *                   job_type: "Remote"
 *                   skills: ["node.js", "postgresql", "docker"]
 *                   contact_email: "hr@acme.com"
 *       400:
 *         description: Missing or empty job description text
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "MISSING_TEXT"
 *                 message: "Job description text is required"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/upload-jd', authMiddleware, uploadJDController);

module.exports = router;
