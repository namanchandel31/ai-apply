class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "RetryableError";
  }
}

class NonRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * NotFoundError — thrown when a resource is not found OR not owned by the requesting user.
 * Both cases surface as HTTP 404 (no existence leakage via 403).
 */
class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(typeof message === "string" ? message : message.message || "Resource not found");
    this.name = "NotFoundError";
    // Attach any extra context (resourceType, resourceId, etc.) for structured logging
    if (typeof message === "object") {
      Object.assign(this, message);
    }
  }
}

/**
 * Raised when a connected OAuth email account can no longer be used (refresh token
 * revoked/expired). Non-retryable — the user must reconnect their account.
 */
class ReauthRequiredError extends NonRetryableError {
  constructor(message = "Email account must be reconnected") {
    super(message);
    this.name = "ReauthRequiredError";
    this.code = "EMAIL_REAUTH_REQUIRED";
    this.stage = "oauth";
  }
}

module.exports = { RetryableError, NonRetryableError, NotFoundError, ReauthRequiredError };
