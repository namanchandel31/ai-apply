/**
 * Retry wrapper for NON-TRANSACTIONAL pool-level queries only.
 *
 * - pool.query / instrumentedQuery(pool) → retry-safe
 * - client.query inside BEGIN/COMMIT → NO implicit retry (inTransaction: true)
 *
 * Future transactional retry: restart entire transaction for idempotent flows only.
 */

const { logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const {
  isTransientPgError,
  isNonRetryablePgError,
} = require("../utils/pgErrors");
const circuit = require("./pgRetryCircuit");

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_MS = 50;
const MAX_DELAY_MS = 2000;

function jitteredDelay(attempt) {
  const exp = Math.min(BASE_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * Math.min(exp, 200));
  return exp + jitter;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {() => Promise<unknown>} fn
 * @param {{ inTransaction?: boolean, queryName?: string, source?: string, maxAttempts?: number }} ctx
 */
async function executeWithPgRetry(fn, ctx = {}) {
  const inTransaction = Boolean(ctx.inTransaction);
  const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const queryName = ctx.queryName ?? "unknown";
  const source = ctx.source ?? "unknown";

  if (inTransaction) {
    return fn();
  }

  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        circuit.recordSuccess();
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (isNonRetryablePgError(err) || !isTransientPgError(err)) {
        throw err;
      }

      circuit.recordTransientFailure();

      if (!circuit.canRetry()) {
        throw err;
      }

      if (attempt >= maxAttempts - 1) {
        throw err;
      }

      const delayMs = jitteredDelay(attempt);
      metrics.increment("db.query.retry", { source, queryName });
      logInfo("DB_QUERY_RETRY", {
        queryName,
        source,
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
        error_code: err?.code,
        error_message: err?.message,
      });

      await sleep(delayMs);
    }
  }
  throw lastErr;
}

module.exports = {
  executeWithPgRetry,
  DEFAULT_MAX_ATTEMPTS,
  jitteredDelay,
};
