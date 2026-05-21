const { logError, logInfo } = require("../utils/logger");
const {
  isRecoverableInfraError,
  shouldLogInfraError,
} = require("../utils/pgErrors");

const BENIGN_NETWORK_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNABORTED",
]);

/** @deprecated Use isRecoverableInfraError from pgErrors */
function isBenignNetworkError(err) {
  return isRecoverableInfraError(err);
}

/**
 * Structured network/subsystem error log (grep-friendly).
 */
function logNetworkError(subsystem, err, extra = {}) {
  if (!shouldLogInfraError(err)) return;

  const payload = {
    event: "NETWORK_ERROR",
    subsystem,
    error_code: err?.code,
    error_message: err?.message,
    error_name: err?.name,
    recoverable: isRecoverableInfraError(err),
    ...extra,
  };
  logError("NETWORK_ERROR", err, payload);
}

function attachRedisErrorHandler(client, subsystem, extra = {}) {
  if (!client || client.__networkErrorHandlerAttached) return client;
  client.__networkErrorHandlerAttached = true;
  client.on("error", (err) => {
    logNetworkError(subsystem, err, {
      ...extra,
      hypothesisId: extra.hypothesisId || "C",
      phase: "redis_error_event",
    });
  });
  client.on("close", () => {
    logInfo("REDIS_CONNECTION_CLOSED", { subsystem, status: client.status });
  });
  return client;
}

module.exports = {
  BENIGN_NETWORK_CODES,
  isBenignNetworkError,
  isRecoverableInfraError,
  logNetworkError,
  attachRedisErrorHandler,
};
