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
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
  };
}

function attachPoolErrorHandler(pool) {
  pool.on("error", (err) => {
    logger.error(
      {
        err,
        event: "PG_POOL_ERROR",
        error_type: err?.name,
        error_message: err?.message,
      },
      "Unexpected error on idle PostgreSQL client"
    );
  });
}

const pool = new Pool(buildPoolConfig());
attachPoolErrorHandler(pool);
wrapPoolQuery(pool);

async function testConnection() {
  try {
    await connectWithTiming(pool);
    logInfo("DB_CONNECTED", { event: "DB_CONNECTED" });
    return true;
  } catch (err) {
    logError("DB_CONNECTION_FAILED", err);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  instrumentedQuery,
  getPoolMetrics,
  startPoolMetricsLogging,
  stopPoolMetricsLogging,
  buildPoolConfig,
  attachPoolErrorHandler,
};
