const { logInfo, logError } = require("../utils/logger");

const BUDGET_LIMIT = parseInt(process.env.LLM_GLOBAL_RETRY_BUDGET || "100", 10);
const BUDGET_WINDOW_MS = parseInt(process.env.LLM_RETRY_WINDOW_MS || "60000", 10);

const CB_THRESHOLD = parseInt(process.env.LLM_CIRCUIT_BREAKER_THRESHOLD || "10", 10);
const CB_COOLDOWN_MS = parseInt(process.env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS || "30000", 10);

/**
 * ARCHITECTURE LIMITATION: Process-Local State
 * 
 * - The circuit breaker state is NOT shared across instances.
 * - The retry budget is strictly process-local.
 * - Behavior changes under horizontal scaling (each instance tracks its own budget/circuit).
 * 
 * Future Evolution: If moving to a highly distributed environment with frequent provider
 * outages, consider a Redis-backed sliding window, but keep it lightweight.
 */
class LlmProtectionLayer {
  constructor() {
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.halfOpenProbeActive = false;

    // Retry budget tracking
    this.retryTimestamps = [];

    // Memory-safe rolling metrics
    // TODO: Consider implementing rolling uptime metrics, periodic metric resets, 
    // or windowed operational stats to prevent indefinite tracking bounds.
    this.metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      cancellationCount: 0,
      quotaExhaustionCount: 0,
      totalLatencyMs: 0, // Used for rolling average
    };
  }

  /**
   * Evaluates if a request is allowed to proceed based on the circuit breaker.
   */
  checkCircuit() {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > CB_COOLDOWN_MS) {
        if (this.state !== "OPEN") return { allowed: true }; // Guard state mutation race
        this.state = "HALF_OPEN";
        logInfo("LLM_CIRCUIT_HALF_OPEN", { message: "Circuit breaker entering HALF_OPEN state" });
      } else {
        return { allowed: false, reason: "Circuit is OPEN" };
      }
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenProbeActive) {
        logInfo("LLM_HALF_OPEN_PROBE_REJECTED", { message: "Probe already active, rejecting concurrent request" });
        return { allowed: false, reason: "HALF_OPEN probe already active" };
      }
      this.halfOpenProbeActive = true;
      logInfo("LLM_HALF_OPEN_PROBE_STARTED", { message: "Allowing single probe request in HALF_OPEN state" });
    }

    return { allowed: true };
  }

  /**
   * Periodically clean up expired retry timestamps to prevent memory leaks during long uptime
   */
  _pruneRetryTimestamps(now) {
    this.retryTimestamps = this.retryTimestamps.filter((ts) => now - ts <= BUDGET_WINDOW_MS);
    // Hard bound to ensure absolute memory safety
    if (this.retryTimestamps.length > BUDGET_LIMIT * 2) {
      this.retryTimestamps = this.retryTimestamps.slice(-BUDGET_LIMIT);
    }
  }

  /**
   * Consume a token from the retry budget.
   * @returns {boolean} True if allowed, False if budget exceeded.
   */
  consumeRetryBudget() {
    const now = Date.now();
    this._pruneRetryTimestamps(now);

    if (this.retryTimestamps.length >= BUDGET_LIMIT) {
      logError("LLM_RETRY_BUDGET_EXCEEDED", new Error("Retry budget exceeded"), { currentRetries: this.retryTimestamps.length, limit: BUDGET_LIMIT });
      return false;
    }

    this.retryTimestamps.push(now);
    logInfo("LLM_RETRY_BUDGET_CONSUMED", { currentRetries: this.retryTimestamps.length, limit: BUDGET_LIMIT });
    return true;
  }

  /**
   * Record a successful response. Closes circuit if HALF_OPEN.
   */
  recordSuccess(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.successCount++;
    this.metrics.totalLatencyMs += latencyMs;

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return; // Guard state race
      this.state = "CLOSED";
      this.consecutiveFailures = 0;
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_SUCCEEDED", { message: "Probe successful" });
      logInfo("LLM_CIRCUIT_CLOSED", { message: "Circuit breaker CLOSED" });
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Record a transient failure (e.g. 5xx, network failure). Affects circuit breaker.
   */
  recordTransientFailure(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;

    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return; // Guard state race
      this.state = "OPEN";
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_FAILED", { message: "Probe failed" });
      logInfo("LLM_HALF_OPEN_REOPENED", { message: "Circuit breaker returning to OPEN state" });
    } else if (this.state === "CLOSED" && this.consecutiveFailures >= CB_THRESHOLD) {
      if (this.state !== "CLOSED") return; // Guard state race
      this.state = "OPEN";
      logError("LLM_CIRCUIT_OPENED", new Error("Circuit breaker opened due to transient failures"), { consecutiveFailures: this.consecutiveFailures });
    }
  }

  /**
   * Record a probe timeout failure. 
   * A timed-out probe must explicitly fail the probe and reopen the circuit.
   */
  recordProbeTimeout(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return; // Guard state race
      this.state = "OPEN";
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_TIMEOUT", { message: "Probe timed out" });
      logInfo("LLM_HALF_OPEN_REOPENED", { message: "Circuit breaker returning to OPEN state due to probe timeout" });
    }
  }

  /**
   * Record a non-retryable failure (e.g. quota exhausted, auth error). Does NOT affect circuit breaker.
   */
  recordNonRetryableFailure(latencyMs, isQuotaExhausted = false) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;

    if (isQuotaExhausted) {
      this.metrics.quotaExhaustionCount++;
    }

    logInfo("LLM_CIRCUIT_SKIPPED_NON_RETRYABLE", { message: "Non-retryable failure ignored by circuit breaker" });

    // If a probe hits a non-retryable error (e.g., bad auth), it doesn't indicate provider health is bad or good.
    // However, it frees the probe lock so another request can try.
    if (this.state === "HALF_OPEN") {
      this.halfOpenProbeActive = false;
    }
  }

  /**
   * Record a cancellation/abort.
   */
  recordCancellation(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.cancellationCount++;
    this.metrics.totalLatencyMs += latencyMs;
    
    // Cancellations do not affect circuit breaker state
    if (this.state === "HALF_OPEN") {
      this.halfOpenProbeActive = false;
    }
  }

  /**
   * Retrieve sanitized operational metrics.
   */
  getMetrics() {
    const avgLatencyMs = this.metrics.totalRequests > 0 
      ? Math.round(this.metrics.totalLatencyMs / this.metrics.totalRequests) 
      : 0;

    return {
      circuitState: this.state,
      consecutiveFailures: this.consecutiveFailures,
      activeRetriesInWindow: this.retryTimestamps.length,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successCount: this.metrics.successCount,
        failureCount: this.metrics.failureCount,
        cancellationCount: this.metrics.cancellationCount,
        quotaExhaustionCount: this.metrics.quotaExhaustionCount,
        averageLatencyMs: avgLatencyMs
      }
    };
  }
}

// Export a singleton instance
const llmProtection = new LlmProtectionLayer();
module.exports = llmProtection;
