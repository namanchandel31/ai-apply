const { Pool } = require("pg");
const config = require("./config");
const { logger, logInfo, logError } = require("./utils/logger");
const {
  instrumentedQuery,
  connectWithTiming,
  wrapPoolQuery,
  getPoolMetrics,
  startPoolMetricsLogging,
  stopPoolMetricsLogging,
} = require("./db/queryInstrumentation");

function buildPoolConfig() {
  return {
    connectionString: config.database.databaseUrl,
    ssl: config.database.ssl,
    max: config.database.poolMax,
    idleTimeoutMillis: config.database.poolIdleTimeoutMs,
    connectionTimeoutMillis: config.database.poolConnectionTimeoutMs,
    keepAlive: true,
  };
}

const GLOBAL_POOL_KEY = "__aiApplyPgPool";
const GLOBAL_POOL_ID_KEY = "__aiApplyPgPoolInstanceId";

function attachPoolErrorHandler(pool, poolInstanceId) {
  pool.on("error", (err) => {
    const { shouldLogInfraError } = require("./utils/pgErrors");
    const { metrics } = require("./observability/orchestrationMetrics");
    const { logNetworkError } = require("./observability/networkError");
    metrics.increment("db.pool.error", { phase: "idle" });
    if (shouldLogInfraError(err)) {
      logNetworkError("postgres_pool", err, {
        hypothesisId: "B",
        phase: "idle_client_error",
        poolInstanceId,
        pid: process.pid,
      });
      logger.error(
        {
          err,
          event: "PG_POOL_ERROR",
          error_type: err?.name,
          error_message: err?.message,
          poolInstanceId,
          pid: process.pid,
        },
        "Unexpected error on idle PostgreSQL client"
      );
    }
  });
}

function getOrCreatePool() {
  if (global[GLOBAL_POOL_KEY]) {
    return {
      pool: global[GLOBAL_POOL_KEY],
      poolInstanceId: global[GLOBAL_POOL_ID_KEY],
      reused: true,
    };
  }

  const poolInstanceId = `pg-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = new Pool(buildPoolConfig());
  attachPoolErrorHandler(created, poolInstanceId);
  wrapPoolQuery(created);
  global[GLOBAL_POOL_KEY] = created;
  global[GLOBAL_POOL_ID_KEY] = poolInstanceId;
  logInfo("PG_POOL_CREATED", {
    poolInstanceId,
    max: buildPoolConfig().max,
    pid: process.pid,
  });
  return { pool: created, poolInstanceId, reused: false };
}

const { pool, poolInstanceId: POOL_INSTANCE_ID } = getOrCreatePool();

async function testConnection() {
  try {
    const { client } = await connectWithTiming(pool);
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    logInfo("DB_CONNECTED", { event: "DB_CONNECTED" });
    return true;
  } catch (err) {
    logError("DB_CONNECTION_FAILED", err);
    return false;
  }
}

module.exports = {
  pool,
  POOL_INSTANCE_ID,
  testConnection,
  instrumentedQuery,
  getPoolMetrics,
  startPoolMetricsLogging,
  stopPoolMetricsLogging,
  buildPoolConfig,
  attachPoolErrorHandler,
};
