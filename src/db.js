const { Pool } = require("pg");
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
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
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
        pgCode: err?.code,
      },
      "Unexpected PostgreSQL pool error"
    );
  });
}

const pool = new Pool(buildPoolConfig());
attachPoolErrorHandler(pool);
wrapPoolQuery(pool);
startPoolMetricsLogging(pool);

/**
 * Test the DB connection — call this once on server start.
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logInfo("database_connected", { message: "Database connected successfully" });
  } catch (err) {
    logError("database_connection_failed", err);
  }
};

async function closePoolIfAny() {
  await pool.end();
}

module.exports = {
  pool,
  instrumentedQuery,
  connectWithTiming,
  getPoolMetrics,
  startPoolMetricsLogging,
  stopPoolMetricsLogging,
  closePoolIfAny,
  testConnection,
  buildPoolConfig,
  attachPoolErrorHandler,
};
