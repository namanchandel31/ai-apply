const { rateLimiter, RATE_LIMITS } = require("../utils/rateLimiter");
const { error, ERROR_CODES } = require("../utils/response");
const { logInfo } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

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
      logInfo(
        "RATE_LIMIT_EXCEEDED",
        buildLogContext({
          tier: "IP_GLOBAL",
          path: req.originalUrl,
          userId: req.user?.id,
          retryAfterSeconds: retryAfter,
        })
      );
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
        logInfo(
          "RATE_LIMIT_EXCEEDED",
          buildLogContext({
            tier: userLimitKey,
            path: req.originalUrl,
            userId,
            retryAfterSeconds: retryAfter,
          })
        );
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

/**
 * Factory: create a rate limit middleware that checks two tiers sequentially (e.g. hourly + daily).
 */
const createDualRateLimit = (tier1Key, tier2Key) => {
  const tier1Cfg = RATE_LIMITS[tier1Key];
  const tier2Cfg = RATE_LIMITS[tier2Key];
  const ipCfg = RATE_LIMITS.IP_GLOBAL;

  if (!tier1Cfg || !tier2Cfg) throw new Error(`Unknown rate limit tiers: ${tier1Key}, ${tier2Key}`);

  return (req, res, next) => {
    const userId = req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress || "unknown";

    // Global IP check
    const ipKey = `ip:${ip}`;
    if (!rateLimiter.check(ipKey, ipCfg.limit, ipCfg.windowSeconds)) {
      const resetTime = rateLimiter.getResetTime(ipKey);
      res.setHeader("Retry-After", resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : ipCfg.windowSeconds);
      return error(res, 429, `Rate limit exceeded per IP`, "RATE_LIMIT_EXCEEDED");
    }

    if (userId) {
      // Tier 1 check
      const t1Key = `user:${userId}:${tier1Key}`;
      if (!rateLimiter.check(t1Key, tier1Cfg.limit, tier1Cfg.windowSeconds)) {
        const resetTime = rateLimiter.getResetTime(t1Key);
        res.setHeader("Retry-After", resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : tier1Cfg.windowSeconds);
        return error(res, 429, `Hourly rate limit exceeded`, "RATE_LIMIT_EXCEEDED");
      }

      // Tier 2 check
      const t2Key = `user:${userId}:${tier2Key}`;
      if (!rateLimiter.check(t2Key, tier2Cfg.limit, tier2Cfg.windowSeconds)) {
        const resetTime = rateLimiter.getResetTime(t2Key);
        res.setHeader("Retry-After", resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : tier2Cfg.windowSeconds);
        return error(res, 429, `Daily rate limit exceeded`, "RATE_LIMIT_EXCEEDED");
      }
    }

    next();
  };
};

module.exports = {
  applyRateLimit:  createRateLimit("USER_APPLY_SEND"),
  uploadRateLimit: createRateLimit("USER_UPLOAD"),
  readRateLimit:   createRateLimit("USER_READ"),
  aiRateLimit:     createRateLimit("USER_AI"),
  certificationRateLimit: createRateLimit("USER_MODEL_CERTIFICATION"),
  autoApplyRateLimit: createDualRateLimit("USER_AUTO_APPLY_HOURLY", "USER_AUTO_APPLY_DAILY"),
};
