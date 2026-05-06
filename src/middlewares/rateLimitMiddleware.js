const { rateLimiter, RATE_LIMITS } = require('../utils/rateLimiter');
const { error, ERROR_CODES } = require('../utils/response');

/**
 * Create rate limiting middleware
 * @param {string} type - Type of rate limit ('apply' or 'send')
 * @returns {Function} Express middleware
 */
const createRateLimit = (type) => {
  return (req, res, next) => {
    const userKey = req.user ? `user:${req.user.id}` : null;
    const ipKey = `ip:${req.ip || req.connection.remoteAddress}`;
    
    let userLimit, ipLimit;
    
    if (type === 'apply') {
      userLimit = RATE_LIMITS.USER_APPLY;
      ipLimit = RATE_LIMITS.IP_APPLY;
    } else if (type === 'send') {
      userLimit = RATE_LIMITS.USER_SEND;
      ipLimit = RATE_LIMITS.IP_SEND;
    } else {
      return next(new Error('Invalid rate limit type'));
    }
    
    // Check user rate limit (if authenticated)
    if (userKey && !rateLimiter.check(userKey, userLimit.limit, userLimit.windowSeconds)) {
      return error(
        res, 
        429, 
        `Rate limit exceeded: ${userLimit.limit} requests per ${userLimit.windowSeconds} seconds per user`,
        'RATE_LIMIT_EXCEEDED'
      );
    }
    
    // Check IP rate limit (always)
    if (!rateLimiter.check(ipKey, ipLimit.limit, ipLimit.windowSeconds)) {
      return error(
        res, 
        429, 
        `Rate limit exceeded: ${ipLimit.limit} requests per ${ipLimit.windowSeconds} seconds per IP`,
        'RATE_LIMIT_EXCEEDED'
      );
    }
    
    // Add rate limit headers for client info
    res.set({
      'X-RateLimit-Limit-User': userLimit.limit,
      'X-RateLimit-Remaining-User': userKey ? rateLimiter.getRemaining(userKey, userLimit.limit) : 'N/A',
      'X-RateLimit-Limit-IP': ipLimit.limit,
      'X-RateLimit-Remaining-IP': rateLimiter.getRemaining(ipKey, ipLimit.limit)
    });
    
    next();
  };
};

module.exports = {
  applyRateLimit: createRateLimit('apply'),
  sendRateLimit: createRateLimit('send')
};
