const { LOCAL_HEALTH_CHECK_TIMEOUT_MS } = require("../config/aiTimeoutConfig");
const { LOCAL_STUB_CAPABILITIES } = require("./capabilities");
const { NonRetryableError } = require("../utils/errors");
const { createOperationTimeout, classifyHealthCheckError } = require("../utils/operationTimeout");

module.exports = {
  id: "ollama",
  providerType: "local",
  adapterVersion: "1.0.0",
  capabilities: LOCAL_STUB_CAPABILITIES,

  async generateStructuredJson() {
    throw new NonRetryableError("LOCAL_PROVIDER_NOT_IMPLEMENTED: Ollama execution is not available yet");
  },

  async generateText() {
    throw new NonRetryableError("LOCAL_PROVIDER_NOT_IMPLEMENTED: Ollama execution is not available yet");
  },

  async healthCheck({ credentials }) {
    const baseUrl = credentials?.baseUrl;
    if (!baseUrl) return { ok: false, error: "base_url required for local provider" };
    const timeoutMs = LOCAL_HEALTH_CHECK_TIMEOUT_MS;
    const op = createOperationTimeout(timeoutMs, {
      operationType: "health_check",
      provider: "ollama",
    });
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: op.signal });
      return { ok: res.ok, method: "ollama_tags", elapsedMs: op.elapsedMs(), estimatedCost: 0 };
    } catch (err) {
      const failure = classifyHealthCheckError(err, {
        timeoutMs,
        elapsedMs: op.elapsedMs(),
        provider: "ollama",
        wasTimedOut: op.wasTimedOut(),
      });
      return { ok: false, error: failure.message, code: failure.code, errorType: failure.errorType };
    } finally {
      op.clear();
    }
  },

  estimateCost() {
    return 0;
  },
};
