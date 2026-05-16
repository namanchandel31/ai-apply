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

module.exports = { RetryableError, NonRetryableError, NotFoundError };
