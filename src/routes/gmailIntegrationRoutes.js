const express = require("express");
const supabaseAuthMiddleware = require("../middlewares/supabaseAuthMiddleware");
const {
  connectController,
  callbackController,
  statusController,
  disconnectController,
} = require("../controllers/gmailIntegrationController");

const router = express.Router();

/**
 * @openapi
 * /api/integrations/gmail/connect:
 *   get:
 *     operationId: gmailConnect
 *     tags: [Integrations]
 *     summary: Start the Gmail OAuth flow (returns the Google consent URL)
 *     parameters:
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [send, send_read] }
 *         description: Scope tier. send_read is ignored unless the read tier is enabled.
 *     responses:
 *       200: { description: Authorization URL }
 *       503: { description: Gmail integration not configured }
 */
router.get("/integrations/gmail/connect", supabaseAuthMiddleware, connectController);

/**
 * @openapi
 * /api/integrations/gmail/callback:
 *   get:
 *     operationId: gmailCallback
 *     tags: [Integrations]
 *     summary: Google OAuth redirect target (no auth — identity via signed state)
 *     responses:
 *       302: { description: Redirect back to the SPA }
 */
router.get("/integrations/gmail/callback", callbackController);

/**
 * @openapi
 * /api/integrations/gmail/status:
 *   get:
 *     operationId: gmailStatus
 *     tags: [Integrations]
 *     summary: Current Gmail connection status for the user
 *     responses:
 *       200: { description: Connection status }
 */
router.get("/integrations/gmail/status", supabaseAuthMiddleware, statusController);

/**
 * @openapi
 * /api/integrations/gmail/disconnect:
 *   post:
 *     operationId: gmailDisconnect
 *     tags: [Integrations]
 *     summary: Revoke at Google and remove the stored Gmail account
 *     responses:
 *       200: { description: Disconnected }
 */
router.post("/integrations/gmail/disconnect", supabaseAuthMiddleware, disconnectController);

module.exports = router;
