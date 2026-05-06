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

// Rate limit configurations
const RATE_LIMITS = {
  // Per-user limits
  USER_APPLY: { limit: 10, windowSeconds: 60 }, // 10 applies per minute per user
  USER_SEND: { limit: 5, windowSeconds: 60 },   // 5 sends per minute per user
  
  // Per-IP fallback limits
  IP_APPLY: { limit: 50, windowSeconds: 60 },   // 50 applies per minute per IP
  IP_SEND: { limit: 20, windowSeconds: 60 },    // 20 sends per minute per IP
};

module.exports = {
  rateLimiter,
  RATE_LIMITS
};
