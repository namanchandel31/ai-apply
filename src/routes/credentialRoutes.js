const express = require('express');
const { saveEmailCredentialsController } = require('../controllers/credentialController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/save-email-credentials:
 *   post:
 *     operationId: saveEmailCredentials
 *     tags: [Credentials]
 *     summary: Store encrypted SMTP email credentials
 *     description: |
 *       Saves the sender's email credentials, encrypted at rest using AES-256-CBC.
 *       Credentials are used by the send pipeline to authenticate with the SMTP provider.
 *
 *       Supported providers: `gmail`, `outlook`.
 *       For Gmail, use an **App Password** (not your account password).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CredentialRequest'
 *           example:
 *             email: "sender@gmail.com"
 *             password: "abcd efgh ijkl mnop"
 *             provider: "gmail"
 *     responses:
 *       200:
 *         description: Credentials saved and encrypted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               credentialId: "550e8400-e29b-41d4-a716-446655440003"
 *       400:
 *         description: Missing or invalid credential fields
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error:
 *                 code: "VALIDATION_ERROR"
 *                 message: "provider must be one of: gmail, outlook"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/save-email-credentials', authMiddleware, saveEmailCredentialsController);

module.exports = router;
