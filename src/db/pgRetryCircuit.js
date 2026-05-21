/**
 * In-memory circuit breaker for pool-level PG query retries.
 * Prevents retry amplification during outages (workers × retries × pool saturation).
 */

const { metrics } = require("../observability/orchestrationMetrics");
const { logInfo } = require("../utils/logger");
const { shouldLogInfraError } = require("../utils/pgErrors");

const WINDOW_MS = 30_000;
const FAILURE_THRESHOLD = 10;
const DEFAULT_COOLDOWN_MS = 20_000;

/** @type {{ failures: number[], openedAt: number | null, cooldownMs: number }} */
let state = {
  failures: [],
  openedAt: null,
  cooldownMs: DEFAULT_COOLDOWN_MS,
};

function getCooldownMs() {
  try {
    const config = require("../config");
    return config.database.pgRetryCircuitCooldownMs ?? DEFAULT_COOLDOWN_MS;
  } catch {
    return DEFAULT_COOLDOWN_MS;
  }
}

function pruneFailures(now) {
  state.failures = state.failures.filter((t) => now - t < WINDOW_MS);
}

function isOpen(now = Date.now()) {
  if (!state.openedAt) return false;
  const cooldown = state.cooldownMs || getCooldownMs();
  if (now - state.openedAt >= cooldown) {
    return false;
  }
  return true;
}

function recordTransientFailure() {
  const now = Date.now();
  pruneFailures(now);
  state.failures.push(now);
  state.cooldownMs = getCooldownMs();

  if (state.failures.length >= FAILURE_THRESHOLD && !state.openedAt) {
    state.openedAt = now;
    metrics.increment("db.retry.circuit_open");
    if (shouldLogInfraError({ code: "CIRCUIT_OPEN", message: "pg retry circuit open" })) {
      logInfo("DB_RETRY_CIRCUIT_OPEN", {
        failuresInWindow: state.failures.length,
        cooldownMs: state.cooldownMs,
      });
    }
  }
}

function recordSuccess() {
  state.openedAt = null;
  state.failures = [];
}

function recordProbeFailure() {
  recordTransientFailure();
  state.openedAt = Date.now();
}

function canRetry(now = Date.now()) {
  state.cooldownMs = getCooldownMs();
  if (!isOpen(now)) {
    if (state.openedAt && now - state.openedAt >= state.cooldownMs) {
      metrics.increment("db.retry.circuit_probe", { phase: "half_open" });
      return true;
    }
    return true;
  }
  return false;
}

function resetCircuitForTests() {
  state = { failures: [], openedAt: null, cooldownMs: DEFAULT_COOLDOWN_MS };
}

module.exports = {
  recordTransientFailure,
  recordSuccess,
  recordProbeFailure,
  canRetry,
  isOpen,
  resetCircuitForTests,
  FAILURE_THRESHOLD,
  WINDOW_MS,
};
