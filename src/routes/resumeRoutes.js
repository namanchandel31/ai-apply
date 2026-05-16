const express = require('express');
const uploadMiddleware = require('../middlewares/upload');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadResumeController } = require('../controllers/resumeController');

const router = express.Router();

/**
 * @openapi
 * /api/upload-resume:
 *   post:
 *     operationId: uploadResume
 *     tags: [Upload]
 *     summary: Upload and parse a resume file
 *     description: |
 *       Accepts a PDF or DOCX resume file via multipart/form-data.
 *       The file is stored in Supabase Storage and parsed by the LLM pipeline.
 *
 *       **Constraints:**
 *       - Accepted MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
 *       - Accepted extensions: `.pdf`, `.docx`
 *       - Max file size: **10MB**
 *       - Form field name: `file`
 *
 *       > Note: Multipart handling is implemented by the existing multer middleware.
 *       > Swagger documents the contract only.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "PDF or DOCX only. Max size: 10MB."
 *     responses:
 *       200:
 *         description: Resume parsed and stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResumeUploadResponse'
 *             example:
 *               success: true
 *               data:
 *                 resumeId: "550e8400-e29b-41d4-a716-446655440001"
 *                 fileUrl: "https://storage.example.com/resumes/550e8400-e29b-41d4-a716-446655440001.pdf"
 *                 parsedData:
 *                   name: "Jane Doe"
 *                   skills: ["node.js", "postgresql", "docker"]
 *       400:
 *         description: Invalid file type or file exceeds size limit
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "INVALID_FILE"
 *                 message: "Only PDF and DOCX files accepted. Max size: 10MB."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/upload-resume', authMiddleware, uploadMiddleware, uploadResumeController);

module.exports = router;
