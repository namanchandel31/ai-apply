const { rateLimiter, RATE_LIMITS } = require("../utils/rateLimiter");
const { error, ERROR_CODES } = require("../utils/response");

/**
 * Factory: create a rate limit middleware for a named tier.
 *
 * Key resolution: req.user?.id (per-user bucket when authenticated) with a
 * shared IP_GLOBAL fallback ceiling applied on every request regardless of auth.
 *
 * On limit exceeded, responds with:
 *   { success: false, error: "RATE_LIMIT_EXCEEDED", retryAfterSeconds: N }
 * and sets the Retry-After header.
 */
const createRateLimit = (userLimitKey) => {
  const userCfg = RATE_LIMITS[userLimitKey];
  const ipCfg   = RATE_LIMITS.IP_GLOBAL;

  if (!userCfg) throw new Error(`Unknown rate limit tier: ${userLimitKey}`);

  return (req, res, next) => {
    const userId = req.user?.id;
    const ip     = req.ip || req.connection?.remoteAddress || "unknown";

    // ── Per-IP global ceiling (always checked, regardless of auth) ───────
    const ipKey = `ip:${ip}`;
    if (!rateLimiter.check(ipKey, ipCfg.limit, ipCfg.windowSeconds)) {
      const resetTime = rateLimiter.getResetTime(ipKey);
      const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : ipCfg.windowSeconds;
      res.setHeader("Retry-After", retryAfter);
      return error(
        res, 429,
        `Rate limit exceeded: ${ipCfg.limit} requests per ${ipCfg.windowSeconds}s per IP`,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // ── Per-user tier (only when authenticated) ──────────────────────────
    if (userId) {
      const userKey = `user:${userId}:${userLimitKey}`;
      if (!rateLimiter.check(userKey, userCfg.limit, userCfg.windowSeconds)) {
        const resetTime = rateLimiter.getResetTime(userKey);
        const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : userCfg.windowSeconds;
        res.setHeader("Retry-After", retryAfter);
        return error(
          res, 429,
          `Rate limit exceeded: ${userCfg.limit} requests per ${userCfg.windowSeconds}s`,
          "RATE_LIMIT_EXCEEDED"
        );
      }

      // Informational headers for client-side adaptive throttling
      const userKey2 = `user:${userId}:${userLimitKey}`;
      res.setHeader("X-RateLimit-Limit", userCfg.limit);
      res.setHeader("X-RateLimit-Remaining", rateLimiter.getRemaining(userKey2, userCfg.limit));
    }

    next();
  };
};

module.exports = {
  applyRateLimit:  createRateLimit("USER_APPLY_SEND"),
  uploadRateLimit: createRateLimit("USER_UPLOAD"),
  readRateLimit:   createRateLimit("USER_READ"),
};
