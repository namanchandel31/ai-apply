/**
 * Structured API error responses for lifecycle endpoints.
 */
function sendError(res, { status = 500, code, message, retryable = false, meta = undefined }) {
  let safeMessage = message;
  if (status >= 500 && require("../config").server.isProduction) {
    safeMessage = "Internal server error";
  }

  return res.status(status).json({
    success: false,
    error: {
      code,
      message: safeMessage,
      retryable,
      ...(meta ? { meta } : {}),
    },
  });
}

module.exports = { sendError };
