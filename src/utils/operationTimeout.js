const { logInfo } = require("./logger");

/**
 * AbortController + timer for a single outbound operation.
 * Caller must call clear() in finally.
 */
function createOperationTimeout(timeoutMs, meta = {}) {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    const elapsedMs = Date.now() - startedAt;
    logInfo("AI_OPERATION_TIMEOUT", {
      operationType: meta.operationType || "unknown",
      provider: meta.provider,
      model: meta.model,
      timeoutMs,
      elapsedMs,
      reason: "client_abort_timeout",
    });
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    startedAt,
    timeoutMs,
    operationType: meta.operationType,
    wasTimedOut: () => timedOut,
    elapsedMs: () => Date.now() - startedAt,
    clear: () => clearTimeout(timeoutId),
  };
}

function isAbortError(err) {
  return err?.name === "AbortError" || err?.code === "ABORT_ERR";
}

function isNetworkError(err) {
  return ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED", "ECONNABORTED"].includes(err?.code);
}

/**
 * Classify health-check / test-connection failures for API responses and logs.
 */
function classifyHealthCheckError(err, { timeoutMs, elapsedMs, provider, wasTimedOut }) {
  if (wasTimedOut || isAbortError(err)) {
    return {
      code: "HEALTH_CHECK_TIMEOUT",
      errorType: "abort_timeout",
      message: `Connection test timed out after ${timeoutMs}ms`,
      retryable: true,
    };
  }

  if (isNetworkError(err)) {
    const isProviderSideTimeout = err.code === "ETIMEDOUT" || err.code === "ECONNABORTED";
    return {
      code: isProviderSideTimeout ? "PROVIDER_TIMEOUT" : "NETWORK_FAILURE",
      errorType: isProviderSideTimeout ? "provider_timeout" : "network_failure",
      message: err.message || "Network error during health check",
      retryable: true,
    };
  }

  if (err.status === 401 || err.status === 403) {
    return {
      code: "AUTH_FAILURE",
      errorType: "auth_failure",
      message: err.message || "Authentication failed",
      retryable: false,
    };
  }

  const message = err.message || err.error?.message || "Health check failed";
  const isModelError =
    err.status === 404 ||
    message.toLowerCase().includes("model") ||
    err.error?.code === "model_not_found";

  if (isModelError) {
    return {
      code: "AI_MODEL_INVALID",
      errorType: "invalid_model",
      message,
      retryable: false,
    };
  }

  if (err.status === 400) {
    return {
      code: "PROVIDER_ERROR",
      errorType: "provider_error",
      message,
      retryable: false,
    };
  }

  if (err.status && [429, 500, 502, 503, 504].includes(err.status)) {
    const isProviderTimeout = err.status === 504;
    return {
      code: isProviderTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR",
      errorType: isProviderTimeout ? "provider_timeout" : "provider_error",
      message,
      retryable: true,
    };
  }

  return {
    code: "PROVIDER_ERROR",
    errorType: "provider_error",
    message,
    retryable: false,
  };
}

module.exports = {
  createOperationTimeout,
  classifyHealthCheckError,
  isAbortError,
  isNetworkError,
};
