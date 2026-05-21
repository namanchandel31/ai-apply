const { str, int } = require("./env");
const { isProduction } = require("./server.config");

module.exports = {
  databaseUrl: str("DATABASE_URL", null),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  poolMax: int("PG_POOL_MAX", 10),
  poolIdleTimeoutMs: int("PG_POOL_IDLE_TIMEOUT_MS", 30000),
  poolConnectionTimeoutMs: int("PG_POOL_CONNECTION_TIMEOUT_MS", 10000),
  pgRetryCircuitCooldownMs: int("PG_RETRY_CIRCUIT_COOLDOWN_MS", 20000),
};
