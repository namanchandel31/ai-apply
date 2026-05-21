/**
 * Safe PostgreSQL client acquisition with idempotent error listeners.
 */

const { logError, logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { shouldLogInfraError } = require("../utils/pgErrors");

const txnContext = new Set();

function isInTransactionContext(client) {
  return Boolean(client && txnContext.has(client));
}

function markClientInTransaction(client) {
  if (client) txnContext.add(client);
}

function clearClientTransaction(client) {
  if (client) txnContext.delete(client);
}

function attachPgClientErrorHandler(client, meta = {}) {
  if (!client) return client;
  if (client.__pgErrorHandlerAttached) return client;
  if (typeof client.on !== "function") return client;
  client.__pgErrorHandlerAttached = true;

  client.on("error", (err) => {
    metrics.increment("db.client.error", { phase: "checked_out" });
    if (shouldLogInfraError(err)) {
      logError("PG_CLIENT_ERROR", err, {
        event: "PG_CLIENT_ERROR",
        error_code: err?.code,
        error_message: err?.message,
        poolInstanceId: meta.poolInstanceId,
        pid: process.pid,
      });
    }
  });

  return client;
}

async function acquirePgClient(pool, meta = {}) {
  const connectStart = performance.now();
  const client = await pool.connect();
  const poolWaitMs = Math.round(performance.now() - connectStart);
  attachPgClientErrorHandler(client, meta);

  if (poolWaitMs > 100 || (pool.waitingCount ?? 0) > 0) {
    logInfo("DB_POOL_CONNECT_SLOW", {
      poolWaitMs,
      poolTotal: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount,
    });
    metrics.histogram("db.pool.acquire_wait_ms", poolWaitMs);
  }

  return { client, poolWaitMs };
}

/**
 * Acquire client, attach error handler, run fn, always release.
 */
async function withPgClient(pool, fn, meta = {}) {
  const { client } = await acquirePgClient(pool, meta);
  try {
    return await fn(client);
  } finally {
    clearClientTransaction(client);
    client.release();
  }
}

/**
 * BEGIN … COMMIT/ROLLBACK — disables implicit query retry for this client.
 */
async function withPgTransaction(pool, fn, meta = {}) {
  return withPgClient(pool, async (client) => {
    await client.query("BEGIN");
    markClientInTransaction(client);
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      clearClientTransaction(client);
    }
  }, meta);
}

function resetPgClientContextForTests() {
  txnContext.clear();
}

module.exports = {
  attachPgClientErrorHandler,
  acquirePgClient,
  withPgClient,
  withPgTransaction,
  isInTransactionContext,
  markClientInTransaction,
  clearClientTransaction,
  resetPgClientContextForTests,
};
