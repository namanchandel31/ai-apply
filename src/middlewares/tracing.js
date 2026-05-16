const crypto = require("crypto");

/**
 * Tracing middleware.
 *
 * Generates a UUID v4 requestId for every incoming HTTP request, attaches it
 * to `req.requestId`, and echoes it back in the `X-Request-Id` response header.
 *
 * Must be the FIRST middleware mounted in index.js so that all downstream
 * middleware, route handlers, and services can read `req.requestId`.
 *
 * Replaces the ad-hoc `crypto.randomBytes(6).toString('hex')` pattern spread
 * across individual controllers — single source of truth for request tracing.
 */
const tracingMiddleware = (req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

module.exports = tracingMiddleware;
