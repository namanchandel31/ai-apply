/**
 * Centralized response helpers for consistent API responses
 * 
 * Usage:
 * - error(res, 404, "Resource not found", "NOT_FOUND")
 * - ok(res, { id: "123", name: "test" })
 * - ok(res, data, { idempotent: true }) // For idempotent operations
 */

/**
 * Send error response with standardized format
 * @param {Response} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code for client handling
 */
/**
 * Structured error response (preferred for new endpoints).
 */
function fail(res, status, { message, code, retryable = false }) {
  let errorMessage = message;
  if (status === 500 && require("../config").server.isProduction) {
    errorMessage = "Internal server error";
  }
  return res.status(status).json({
    success: false,
    message: errorMessage,
    code,
    retryable,
  });
}

function error(res, status, message, code) {
  // Hide internal error details in production
  let errorMessage = message;
  if (status === 500 && require("../config").server.isProduction) {
    errorMessage = "Internal server error";
  }

  return res.status(status).json({
    success: false,
    error: errorMessage,
    code
  });
}

/**
 * Send success response with standardized format
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {Object} options - Additional options
 * @param {boolean} options.idempotent - Whether this was an idempotent operation
 */
function ok(res, data, options = {}) {
  const response = {
    success: true,
    data
  };

  // Add idempotent flag if specified
  if (options.idempotent) {
    response.idempotent = true;
  }

  return res.status(200).json(response);
}

/**
 * Common error codes for consistency
 */
const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

module.exports = {
  error,
  fail,
  ok,
  ERROR_CODES,
};
