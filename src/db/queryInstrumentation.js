const crypto = require("crypto");
const { logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const { executeWithPgRetry } = require("./pgQueryRetry");
const {
  attachPgClientErrorHandler,
  isInTransactionContext,
} = require("./pgClient");

const SLOW_QUERY_MS = 100;
const STATUS_QUERY_NAMES = new Set([
  "status_snapshot",
  "status_jobs_latest",
  "status_bundle",
  "status_fingerprint",
]);

const logging = require("../config/logging.config");

function queryShapeLoggingEnabled() {
  return logging.hasDebugScope("query");
}

function getPoolMetrics(pool) {
  if (!pool || typeof pool.totalCount !== "number") {
    return { poolTotal: 0, poolIdle: 0, poolWaiting: 0 };
  }
  return {
    poolTotal: pool.totalCount,
    poolIdle: pool.idleCount,
    poolWaiting: pool.waitingCount,
  };
}

function logQueryEvent(event, metadata) {
  logInfo(event, metadata);
}

function sqlHash(text) {
  if (typeof text !== "string") return null;
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function isQueryInstance(value) {
  return Boolean(value && typeof value.submit === "function");
}

/**
 * Build an immutable pg query config. Never sets `name` (avoids prepared-statement reuse collisions).
 */
function buildQueryConfig(text, values) {
  if (isQueryInstance(text)) {
    return text;
  }

  if (text && typeof text === "object") {
    const cloned = {
      ...text,
      name: undefined,
    };
    if (Array.isArray(text.values)) {
      cloned.values = [...text.values];
    }
    return cloned;
  }

  const config = { text: String(text) };
  if (values !== undefined && values !== null) {
    if (typeof values === "function") {
      config.callback = values;
    } else if (Array.isArray(values)) {
      config.values = [...values];
    } else {
      config.values = values;
    }
  }
  return config;
}

function paramCountForConfig(config) {
  if (isQueryInstance(config)) return null;
  if (!config || typeof config !== "object") return null;
  if (!Array.isArray(config.values)) return 0;
  return config.values.length;
}

function logQueryShape(queryName, config, targetKind) {
  if (!queryShapeLoggingEnabled()) {
    return;
  }
  if (isQueryInstance(config)) {
    logQueryEvent("QUERY_EXEC", { queryName, targetKind, shape: "QueryInstance" });
    return;
  }
  const text = config.text ?? "";
  const payload = {
    queryName,
    targetKind,
    params: paramCountForConfig(config),
    hash: sqlHash(text),
    textLen: text.length,
  };
  logQueryEvent("QUERY_EXEC", payload);
}

/**
 * Execute query without mutating caller args; strips named prepared statements.
 */
function execQuery(target, text, values, callback) {
  if (!target || typeof target.query !== "function") {
    throw new Error("execQuery: invalid query target");
  }

  const config = buildQueryConfig(text, values);
  if (isQueryInstance(config)) {
    if (typeof values === "function") {
      return target.query(config, values);
    }
    if (callback) {
      return target.query(config, callback);
    }
    return target.query(config);
  }

  if (typeof values === "function") {
    return target.query(config, values);
  }
  if (callback) {
    return target.query(config, callback);
  }
  return target.query(config);
}

/**
 * Run a labeled query with timing, row count, and pool pressure metrics.
 */
async function instrumentedQuery(
  client,
  queryName,
  text,
  values,
  poolForMetrics = null,
  options = {}
) {
  const source = options.source || "unknown";
  const metricsPool =
    poolForMetrics && typeof poolForMetrics.totalCount === "number" ? poolForMetrics : null;
  const poolMetricsBefore = metricsPool ? getPoolMetrics(metricsPool) : getPoolMetrics(null);

  if (poolMetricsBefore.poolWaiting >= 5 || poolMetricsBefore.poolIdle === 0) {
    metrics.increment("db.pool.pressure");
    logQueryEvent("DB_POOL_PRESSURE", {
      queryName,
      ...poolMetricsBefore,
    });
  } else if (poolMetricsBefore.poolWaiting >= 3) {
    logQueryEvent("DB_POOL_PRESSURE", {
      queryName,
      ...poolMetricsBefore,
    });
  }

  const config = buildQueryConfig(text, values);
  const isPoolClient = Boolean(client && client.release);
  const targetKind = isPoolClient ? "client" : "pool";
  logQueryShape(queryName, config, targetKind);

  const totalStart = performance.now();
  const queryStart = performance.now();
  let result;

  const queryTarget =
    !isPoolClient && client && typeof client._rawQuery === "function"
      ? { query: client._rawQuery.bind(client) }
      : client;

  const inTransaction = isPoolClient || isInTransactionContext(client);

  const runQuery = () => execQuery(queryTarget, text, values);

  if (inTransaction) {
    result = await runQuery();
  } else {
    result = await executeWithPgRetry(runQuery, {
      inTransaction: false,
      queryName,
      source,
    });
  }

  const durationMs = Math.round(performance.now() - queryStart);
  const totalMs = Math.round(performance.now() - totalStart);
  const poolMetricsAfter = metricsPool ? getPoolMetrics(metricsPool) : poolMetricsBefore;

  const meta = {
    queryName,
    source,
    durationMs,
    totalMs,
    rowCount: result.rowCount ?? result.rows?.length ?? 0,
    poolMetricsBefore,
    poolMetricsAfter,
    likelyPoolAcquire:
      !isPoolClient &&
      poolMetricsBefore.poolTotal === 0 &&
      poolMetricsAfter.poolTotal > 0 &&
      totalMs > durationMs + 50,
  };

  const isStatusPath = STATUS_QUERY_NAMES.has(queryName);
  const isSlow = durationMs > SLOW_QUERY_MS;

  if (isSlow && meta.likelyPoolAcquire) {
    logQueryEvent("DB_POOL_CONNECT_SLOW", {
      queryName,
      totalMs: meta.totalMs,
      durationMs: meta.durationMs,
      rowCount: meta.rowCount,
      poolMetricsBefore: meta.poolMetricsBefore,
      poolMetricsAfter: meta.poolMetricsAfter,
    });
  } else if (isSlow) {
    logQueryEvent("DB_QUERY_SLOW", meta);
  } else if ((isStatusPath && isSlow) || logging.hasDebugScope("query")) {
    logQueryEvent("DB_QUERY", meta);
  }

  return result;
}

/**
 * Acquire a pool client with connect wait timing (for diagnostics).
 */
async function connectWithTiming(pool) {
  const poolMetrics = getPoolMetrics(pool);
  const connectStart = performance.now();
  const client = await pool.connect();
  attachPgClientErrorHandler(client);
  const poolWaitMs = Math.round(performance.now() - connectStart);

  if (poolWaitMs > SLOW_QUERY_MS || poolMetrics.poolWaiting > 0) {
    metrics.histogram("db.pool.acquire_wait_ms", poolWaitMs);
    logQueryEvent("DB_POOL_CONNECT_SLOW", {
      poolWaitMs,
      ...poolMetrics,
    });
  }

  return { client, poolWaitMs, poolMetrics };
}

/**
 * Wrap pool.query once — forward all args; never double-wrap.
 */
function wrapPoolQuery(pool) {
  if (pool.__aiApplyQueryInstrumentationWrapped) {
    return pool;
  }
  pool.__aiApplyQueryInstrumentationWrapped = true;

  const originalQuery = pool.query.bind(pool);
  pool._rawQuery = originalQuery;

  pool.query = function wrappedQuery(...args) {
    const queryStart = performance.now();
    const poolMetrics = getPoolMetrics(pool);
    const first = args[0];
    const hasCallback =
      typeof args[1] === "function" ||
      typeof args[2] === "function" ||
      (first && typeof first === "object" && typeof args[1] === "function");

    if (hasCallback) {
      if (typeof first === "string") {
        const config = buildQueryConfig(first, args[1]);
        logQueryShape("pool.query", config, "pool");
        const cb = typeof args[1] === "function" ? args[1] : args[2];
        return originalQuery(config, cb);
      }
      if (first && typeof first === "object") {
        const config = isQueryInstance(first) ? first : buildQueryConfig(first);
        logQueryShape("pool.query", config, "pool");
        return originalQuery(config, args[1]);
      }
      return originalQuery(...args);
    }

    const runPoolQuery = () => {
      let out;
      if (typeof first === "string") {
        const config = buildQueryConfig(first, args[1]);
        logQueryShape("pool.query", config, "pool");
        out = originalQuery(config);
      } else if (first && typeof first === "object") {
        const config = isQueryInstance(first) ? first : buildQueryConfig(first);
        logQueryShape("pool.query", config, "pool");
        out = originalQuery(config);
      } else {
        out = originalQuery(...args);
      }

      const logSlow = (result) => {
        const totalMs = Math.round(performance.now() - queryStart);
        const poolMetricsAfter = getPoolMetrics(pool);
        const likelyPoolAcquire =
          poolMetrics.poolTotal === 0 && poolMetricsAfter.poolTotal > 0;
        if (totalMs > SLOW_QUERY_MS && !likelyPoolAcquire) {
          logQueryEvent("DB_QUERY_SLOW", {
            queryName: "pool.query",
            durationMs: totalMs,
            totalMs,
            likelyPoolAcquire: false,
            rowCount: result?.rowCount ?? result?.rows?.length ?? 0,
            poolMetricsBefore: poolMetrics,
            poolMetricsAfter,
          });
        } else if (likelyPoolAcquire && totalMs > SLOW_QUERY_MS) {
          logQueryEvent("DB_POOL_CONNECT_SLOW", {
            queryName: "pool.query",
            totalMs,
            rowCount: result?.rowCount ?? result?.rows?.length ?? 0,
            poolMetricsBefore: poolMetrics,
            poolMetricsAfter,
          });
        }
        return result;
      };

      if (out && typeof out.then === "function") {
        return out.then(logSlow);
      }
      return out;
    };

    return executeWithPgRetry(runPoolQuery, {
      inTransaction: false,
      queryName: "pool.query",
      source: "pool",
    });
  };

  return pool;
}

let poolMetricsInterval = null;

function startPoolMetricsLogging(pool, intervalMs = 60_000) {
  if (poolMetricsInterval) return;
  const config = require("../config");
  if (config.server.isProduction && !logging.hasDebugScope("query")) {
    return;
  }

  poolMetricsInterval = setInterval(() => {
    const metrics = getPoolMetrics(pool);
    if (metrics.poolWaiting > 0 || metrics.poolIdle === 0) {
      logQueryEvent("POOL_METRICS", metrics);
    }
  }, intervalMs);

  if (poolMetricsInterval.unref) {
    poolMetricsInterval.unref();
  }
}

function stopPoolMetricsLogging() {
  if (poolMetricsInterval) {
    clearInterval(poolMetricsInterval);
    poolMetricsInterval = null;
  }
}

module.exports = {
  instrumentedQuery,
  connectWithTiming,
  wrapPoolQuery,
  getPoolMetrics,
  buildQueryConfig,
  execQuery,
  sqlHash,
  paramCountForConfig,
  queryShapeLoggingEnabled,
  startPoolMetricsLogging,
  stopPoolMetricsLogging,
  SLOW_QUERY_MS,
  STATUS_QUERY_NAMES,
};
