const config = require("../config");
const gmailIntegrationService = require("../services/gmailIntegrationService");
const { getUserId } = require("../utils/auth");
const { ok, error, ERROR_CODES } = require("../utils/response");
const { logError } = require("../utils/logger");

function spaReturnUrl(params, returnTo = "setup") {
  const base = config.google.appBaseUrl || "";
  if (returnTo === "onboarding") {
    const qs = new URLSearchParams({ gmail: params.gmail, ...(params.reason ? { reason: params.reason } : {}) }).toString();
    return `${base}/onboarding?${qs}`;
  }
  const qs = new URLSearchParams({ tab: "email", ...params }).toString();
  return `${base}/setup?${qs}`;
}

/** GET /api/integrations/gmail/connect?tier=send|send_read&returnTo=setup|onboarding */
async function connectController(req, res) {
  const reqId = req.requestId || "UNKNOWN";
  try {
    const userId = getUserId(req);
    const tier = req.query.tier === "send_read" ? "send_read" : "send";
    const returnTo = req.query.returnTo === "onboarding" ? "onboarding" : "setup";
    const { authorizationUrl } = await gmailIntegrationService.getConnectUrl(
      userId,
      tier,
      req.user?.email,
      returnTo
    );
    return ok(res, { authorizationUrl });
  } catch (err) {
    if (err.code === "GMAIL_NOT_CONFIGURED") {
      return error(res, 503, "Gmail integration is not available", err.code);
    }
    logError("GMAIL_CONNECT_ERROR", err, { reqId });
    return error(res, 500, "Failed to start Gmail connection", ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * GET /api/integrations/gmail/callback?code&state
 * Browser redirect from Google (no bearer token) — identity comes from signed state.
 */
async function callbackController(req, res) {
  const reqId = req.requestId || "UNKNOWN";
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(spaReturnUrl({ gmail: "error", reason: String(oauthError) }));
  }

  try {
    const result = await gmailIntegrationService.handleCallback({ code, state });
    return res.redirect(spaReturnUrl({ gmail: "connected" }, result.returnTo || "setup"));
  } catch (err) {
    logError("GMAIL_CALLBACK_ERROR", err, { reqId, code: err.code });
    const reason = err.code || "callback_failed";
    return res.redirect(spaReturnUrl({ gmail: "error", reason }, "setup"));
  }
}

/** GET /api/integrations/gmail/status */
async function statusController(req, res) {
  const reqId = req.requestId || "UNKNOWN";
  try {
    const status = await gmailIntegrationService.getStatus(getUserId(req));
    return ok(res, status);
  } catch (err) {
    logError("GMAIL_STATUS_ERROR", err, { reqId });
    return error(res, 500, "Failed to fetch Gmail status", ERROR_CODES.INTERNAL_ERROR);
  }
}

/** POST /api/integrations/gmail/disconnect */
async function disconnectController(req, res) {
  const reqId = req.requestId || "UNKNOWN";
  try {
    const result = await gmailIntegrationService.disconnect(getUserId(req));
    return ok(res, result);
  } catch (err) {
    logError("GMAIL_DISCONNECT_ERROR", err, { reqId });
    return error(res, 500, "Failed to disconnect Gmail", ERROR_CODES.INTERNAL_ERROR);
  }
}

module.exports = {
  connectController,
  callbackController,
  statusController,
  disconnectController,
};
