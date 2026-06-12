/**
 * Rate limiting abstraction with dual protection (user + IP)
 * 
 * Current implementation: In-memory Map
 * Future: Redis-ready for multi-instance support
 * 
 * Usage:
 * - rateLimiter.check('user:123', 10, 60) // 10 requests per minute for user 123
 * - rateLimiter.check('ip:192.168.1.1', 50, 60) // 50 requests per minute for IP
 */

class RateLimiter {
  constructor() {
    // In-memory store: Map<key, { count: number, resetTime: number }>
    this.store = new Map();
    
    // Cleanup interval to prevent memory leaks
    setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if a request is allowed based on rate limit
   * @param {string} key - Unique identifier (user:ID or ip:ADDRESS)
   * @param {number} limit - Maximum requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {boolean} - True if request is allowed
   */
  check(key, limit, windowSeconds) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    
    if (!this.store.has(key)) {
      // First request from this key
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    const record = this.store.get(key);
    
    if (now > record.resetTime) {
      // Window has expired, reset
      record.count = 1;
      record.resetTime = now + windowMs;
      return true;
    }
    
    if (record.count >= limit) {
      // Rate limit exceeded
      return false;
    }
    
    // Increment counter
    record.count++;
    return true;
  }

  /**
   * Get remaining requests for a key
   * @param {string} key - Unique identifier
   * @param {number} limit - Maximum requests allowed
   * @returns {number} - Remaining requests
   */
  getRemaining(key, limit) {
    const record = this.store.get(key);
    if (!record) return limit;
    
    const now = Date.now();
    if (now > record.resetTime) return limit;
    
    return Math.max(0, limit - record.count);
  }

  /**
   * Get reset time for a key
   * @param {string} key - Unique identifier
   * @returns {number|null} - Reset time in milliseconds or null if not found
   */
  getResetTime(key) {
    const record = this.store.get(key);
    if (!record) return null;
    
    const now = Date.now();
    if (now > record.resetTime) return null;
    
    return record.resetTime;
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset a specific key (for testing or admin purposes)
   * @param {string} key - Unique identifier to reset
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Get current status for debugging
   * @returns {Object} - Current status
   */
  getStatus() {
    const now = Date.now();
    const active = {};
    
    for (const [key, record] of this.store.entries()) {
      if (now <= record.resetTime) {
        active[key] = {
          count: record.count,
          resetTime: record.resetTime,
          remainingSeconds: Math.ceil((record.resetTime - now) / 1000)
        };
      }
    }
    
    return {
      totalKeys: this.store.size,
      activeKeys: Object.keys(active).length,
      active
    };
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Rate limit configurations — v1 SaaS tiers.
// Key is resolved as req.user?.id || req.ip (per-user bucket; IP fallback for unauth).
//
// Rationale:
//   APPLY_SEND  10/min — Each apply/send call takes 5-15s; 10/min prevents burst abuse
//                        without blocking real user sessions (5-10 jobs per session).
//   UPLOAD      20/min — Re-uploads and test uploads are routine; 20/min is generous
//                        but upload middleware already enforces 10MB + PDF-only.
//   READ       120/min — Status polling and list fetches; 2 req/sec, plenty for any UI.
//   IP_GLOBAL  200/min — Hard ceiling per IP regardless of auth state.
const RATE_LIMITS = {
  USER_APPLY_SEND: { limit: 10,  windowSeconds: 60 },
  USER_UPLOAD:     { limit: 20,  windowSeconds: 60 },
  USER_READ:       { limit: 120, windowSeconds: 60 },
  USER_AI:         { limit: 60,  windowSeconds: 60 },
  USER_AUTO_APPLY_HOURLY: {
    limit: require("../config").product.autoApplyHourlyLimit,
    windowSeconds: 3600,
  },
  USER_AUTO_APPLY_DAILY: {
    limit: require("../config").product.autoApplyDailyLimit,
    windowSeconds: 86400,
  },
  IP_GLOBAL:       { limit: 200, windowSeconds: 60 },
  USER_MODEL_CERTIFICATION: { limit: 5, windowSeconds: 3600 },
};

module.exports = { rateLimiter, RATE_LIMITS };

