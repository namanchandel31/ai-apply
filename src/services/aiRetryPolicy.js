const { RetryableError, NonRetryableError } = require("../utils/errors");
const { classifyProviderError } = require("../providers/providerUtils");

const TERMINAL_HEALTH = new Set(["invalid"]);
const RECOVERABLE_HEALTH = new Set(["rate_limited", "quota_exceeded"]);

/**
 * Unified execution failure classification for gateway fallback + credential health.
 */
function classifyExecutionFailure(err, { httpStatus, providerCode } = {}) {
  const normalized = err instanceof RetryableError || err instanceof NonRetryableError
    ? err
    : classifyProviderError(err);

  const status = httpStatus ?? err?.status;
  const code = providerCode ?? err?.code ?? err?.error?.code;
  const message = (normalized.message || "").toLowerCase();

  if (status === 401 || code === "invalid_api_key" || message.includes("authentication")) {
    return {
      retryable: false,
      healthTransition: "invalid",
      skipCredential: true,
      logCode: "AUTH_INVALID",
      error: normalized,
    };
  }

  if (status === 403 || message.includes("permission denied")) {
    return {
      retryable: false,
      healthTransition: "invalid",
      skipCredential: true,
      logCode: "AUTH_FORBIDDEN",
      error: normalized,
    };
  }

  if (status === 429) {
    const isQuota =
      code === "insufficient_quota" ||
      message.includes("quota") ||
      message.includes("billing");
    if (isQuota) {
      return {
        retryable: false,
        healthTransition: "quota_exceeded",
        skipCredential: true,
        logCode: "QUOTA_EXCEEDED",
        error: normalized,
      };
    }
    return {
      retryable: true,
      healthTransition: "rate_limited",
      skipCredential: false,
      logCode: "RATE_LIMITED",
      error: normalized,
    };
  }

  if (status === 402 || message.includes("payment") || message.includes("billing")) {
    return {
      retryable: false,
      healthTransition: "quota_exceeded",
      skipCredential: true,
      logCode: "QUOTA_EXCEEDED",
      error: normalized,
    };
  }

  if (status && status >= 500) {
    return {
      retryable: true,
      healthTransition: null,
      skipCredential: false,
      logCode: "PROVIDER_5XX",
      error: normalized,
    };
  }

  if (normalized instanceof RetryableError) {
    return {
      retryable: true,
      healthTransition: null,
      skipCredential: false,
      logCode: "RETRYABLE",
      error: normalized,
    };
  }

  return {
    retryable: false,
    healthTransition: null,
    skipCredential: false,
    logCode: "NON_RETRYABLE",
    error: normalized,
  };
}

function shouldSkipCredentialForHealth(healthStatus) {
  if (!healthStatus || healthStatus === "healthy") return false;
  if (healthStatus === "invalid") return true;
  if (healthStatus === "rate_limited" || healthStatus === "quota_exceeded") return true;
  return false;
}

function canAutoRecoverHealth(fromStatus) {
  return RECOVERABLE_HEALTH.has(fromStatus);
}

function isTerminalHealth(status) {
  return TERMINAL_HEALTH.has(status);
}

module.exports = {
  classifyExecutionFailure,
  shouldSkipCredentialForHealth,
  canAutoRecoverHealth,
  isTerminalHealth,
  TERMINAL_HEALTH,
  RECOVERABLE_HEALTH,
};
