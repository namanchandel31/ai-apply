const { RetryableError, NonRetryableError } = require("./errors");

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Retry an async function up to maxAttempts times.
 *
 * - Retries immediately if error is instanceof RetryableError
 * - Throws immediately if error is instanceof NonRetryableError
 * - Falls back to retrying any other unexpected error
 *
 * @param {Function} fn                   - Async function to execute, receives (attempt: number)
 * @param {object}   options
 * @param {number}   options.maxAttempts  - Max number of attempts (default: 3)
 * @param {number}   options.baseDelayMs  - Base delay in ms, multiplied by attempt number (default: 500)
 * @returns {Promise<any>}
 */
const withRetry = async (fn, { maxAttempts = 2, baseDelayMs = 500 } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      // ONLY retry on explicit RetryableError. All others (including unknown) fail immediately.
      if (!(err instanceof RetryableError)) {
        throw err;
      }

      lastError = err;

      if (attempt === maxAttempts) break;

      // Exponential backoff mapping simulating deep retries natively
      // Added random jitter (up to 30% of base delay) to prevent thundering herd / retry storms
      const jitter = Math.random() * baseDelayMs * 0.3;
      const delay = (baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
      await sleep(delay);
    }
  }

  throw lastError;
};

module.exports = { sleep, withRetry };
