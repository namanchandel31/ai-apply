const config = require("../config");
const { logInfo, logError } = require("../utils/logger");

const BUDGET_LIMIT = config.ai.LLM_GLOBAL_RETRY_BUDGET;
const BUDGET_WINDOW_MS = config.ai.LLM_RETRY_WINDOW_MS;
const CB_THRESHOLD = config.ai.LLM_CIRCUIT_BREAKER_THRESHOLD;
const CB_COOLDOWN_MS = config.ai.LLM_CIRCUIT_BREAKER_COOLDOWN_MS;

class LlmProtectionLayer {
  constructor() {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.halfOpenProbeActive = false;
    this.retryTimestamps = [];
    this.metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      cancellationCount: 0,
      quotaExhaustionCount: 0,
      totalLatencyMs: 0,
    };
  }

  checkCircuit() {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > CB_COOLDOWN_MS) {
        if (this.state !== "OPEN") return { allowed: true };
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

  _pruneRetryTimestamps(now) {
    this.retryTimestamps = this.retryTimestamps.filter((ts) => now - ts <= BUDGET_WINDOW_MS);
    if (this.retryTimestamps.length > BUDGET_LIMIT * 2) {
      this.retryTimestamps = this.retryTimestamps.slice(-BUDGET_LIMIT);
    }
  }

  consumeRetryBudget() {
    const now = Date.now();
    this._pruneRetryTimestamps(now);

    if (this.retryTimestamps.length >= BUDGET_LIMIT) {
      logError("LLM_RETRY_BUDGET_EXCEEDED", new Error("Retry budget exceeded"), {
        currentRetries: this.retryTimestamps.length,
        limit: BUDGET_LIMIT,
      });
      return false;
    }

    this.retryTimestamps.push(now);
    logInfo("LLM_RETRY_BUDGET_CONSUMED", {
      currentRetries: this.retryTimestamps.length,
      limit: BUDGET_LIMIT,
    });
    return true;
  }

  recordSuccess(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.successCount++;
    this.metrics.totalLatencyMs += latencyMs;

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return;
      this.state = "CLOSED";
      this.consecutiveFailures = 0;
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_SUCCEEDED", { message: "Probe successful" });
      logInfo("LLM_CIRCUIT_CLOSED", { message: "Circuit breaker CLOSED" });
    } else {
      this.consecutiveFailures = 0;
    }
  }

  recordTransientFailure(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;

    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return;
      this.state = "OPEN";
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_FAILED", { message: "Probe failed" });
      logInfo("LLM_HALF_OPEN_REOPENED", { message: "Circuit breaker returning to OPEN state" });
    } else if (this.state === "CLOSED" && this.consecutiveFailures >= CB_THRESHOLD) {
      if (this.state !== "CLOSED") return;
      this.state = "OPEN";
      logError("LLM_CIRCUIT_OPENED", new Error("Circuit breaker opened due to transient failures"), {
        consecutiveFailures: this.consecutiveFailures,
      });
    }
  }

  recordProbeTimeout(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      if (this.state !== "HALF_OPEN") return;
      this.state = "OPEN";
      this.halfOpenProbeActive = false;
      logInfo("LLM_HALF_OPEN_PROBE_TIMEOUT", { message: "Probe timed out" });
      logInfo("LLM_HALF_OPEN_REOPENED", { message: "Circuit breaker returning to OPEN state due to probe timeout" });
    }
  }

  recordNonRetryableFailure(latencyMs, isQuotaExhausted = false) {
    this.metrics.totalRequests++;
    this.metrics.failureCount++;
    this.metrics.totalLatencyMs += latencyMs;

    if (isQuotaExhausted) {
      this.metrics.quotaExhaustionCount++;
    }

    logInfo("LLM_CIRCUIT_SKIPPED_NON_RETRYABLE", { message: "Non-retryable failure ignored by circuit breaker" });

    if (this.state === "HALF_OPEN") {
      this.halfOpenProbeActive = false;
    }
  }

  recordCancellation(latencyMs) {
    this.metrics.totalRequests++;
    this.metrics.cancellationCount++;
    this.metrics.totalLatencyMs += latencyMs;

    if (this.state === "HALF_OPEN") {
      this.halfOpenProbeActive = false;
    }
  }

  getMetrics() {
    const avgLatencyMs =
      this.metrics.totalRequests > 0
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
        averageLatencyMs: avgLatencyMs,
      },
    };
  }
}

const llmProtection = new LlmProtectionLayer();
module.exports = llmProtection;
