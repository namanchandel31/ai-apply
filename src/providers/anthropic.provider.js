const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { HEALTH_CHECK_TIMEOUT_MS } = require("../config/aiTimeoutConfig");
const { normalizeModelInput } = require("../utils/normalizeModelInput");
const {
  createOperationTimeout,
  classifyHealthCheckError,
} = require("../utils/operationTimeout");
const { logInfo, logError } = require("../utils/logger");
const {
  parseJsonFromText,
  normalizeUsage,
  classifyProviderError,
  DEFAULT_MODELS,
} = require("./providerUtils");
const { estimateCost } = require("../config/providerPricing");
const { NonRetryableError } = require("../utils/errors");

const ANTHROPIC_VERSION = "2023-06-01";

async function anthropicFetch(path, { apiKey, body, signal }) {
  const res = await fetch(`https://api.anthropic.com/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function extractText(data) {
  const block = data.content?.find((c) => c.type === "text");
  return block?.text?.trim() || "";
}

module.exports = {
  id: "anthropic",
  providerType: "remote",
  adapterVersion: "1.0.0",
  capabilities: REMOTE_PARSE_CAPABILITIES,

  async generateStructuredJson({ systemPrompt, userPrompt, model, credentials, signal }) {
    const startedAt = Date.now();
    const apiKey = credentials?.apiKey;
    if (!apiKey) throw new NonRetryableError("Anthropic API key required");
    const resolvedModel = model || credentials?.model || DEFAULT_MODELS.anthropic;

    try {
      const data = await anthropicFetch("/messages", {
        apiKey,
        signal,
        body: {
          model: resolvedModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        },
      });

      const text = extractText(data);
      const parsed = parseJsonFromText(text);
      const usage = normalizeUsage({
        input_tokens: data.usage?.input_tokens,
        output_tokens: data.usage?.output_tokens,
      });

      return {
        parsed,
        text: null,
        raw: data,
        usage,
        model: resolvedModel,
        provider: "anthropic",
        latencyMs: Date.now() - startedAt,
        estimatedCost: estimateCost("anthropic", resolvedModel, usage),
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  },

  async generateText(args) {
    const result = await this.generateStructuredJson(args);
    return {
      ...result,
      parsed: null,
      text: JSON.stringify(result.parsed),
    };
  },

  async healthCheck({ credentials, model }) {
    const apiKey = credentials?.apiKey;
    if (!apiKey) return { ok: false, error: "Missing API key" };
    const normalized = normalizeModelInput(model ?? credentials?.model, { required: true });
    if (!normalized.ok) {
      return { ok: false, error: normalized.message, code: normalized.code, estimatedCost: 0 };
    }
    const probeModel = normalized.model;
    const timeoutMs = HEALTH_CHECK_TIMEOUT_MS;
    logInfo("AI_MODEL_HEALTH_CHECK", {
      provider: "anthropic",
      model: probeModel,
      method: "minimal_message",
      operationType: "health_check",
      timeoutMs,
    });

    const op = createOperationTimeout(timeoutMs, {
      operationType: "health_check",
      provider: "anthropic",
      model: probeModel,
    });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: probeModel,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: op.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          ok: true,
          method: "minimal_message",
          model: probeModel,
          elapsedMs: op.elapsedMs(),
          estimatedCost: 0,
        };
      }
      const err = new Error(data.error?.message || res.statusText);
      err.status = res.status;
      err.error = data.error;
      const failure = classifyHealthCheckError(err, {
        timeoutMs,
        elapsedMs: op.elapsedMs(),
        provider: "anthropic",
        wasTimedOut: op.wasTimedOut(),
      });
      logError("AI_MODEL_PROVIDER_ERROR", err, {
        provider: "anthropic",
        model: probeModel,
        operationType: "health_check",
        timeoutMs,
        elapsedMs: op.elapsedMs(),
        errorType: failure.errorType,
        code: failure.code,
        statusCode: res.status,
        providerCode: data.error?.type,
      });
      if (failure.code === "AI_MODEL_INVALID") {
        logInfo("AI_MODEL_INVALID", { provider: "anthropic", model: probeModel });
      }
      return {
        ok: false,
        error: failure.message,
        code: failure.code,
        errorType: failure.errorType,
        model: probeModel,
        elapsedMs: op.elapsedMs(),
        estimatedCost: 0,
      };
    } catch (err) {
      const failure = classifyHealthCheckError(err, {
        timeoutMs,
        elapsedMs: op.elapsedMs(),
        provider: "anthropic",
        wasTimedOut: op.wasTimedOut(),
      });
      logError("AI_MODEL_PROVIDER_ERROR", err, {
        provider: "anthropic",
        model: probeModel,
        operationType: "health_check",
        timeoutMs,
        elapsedMs: op.elapsedMs(),
        errorType: failure.errorType,
        code: failure.code,
      });
      return {
        ok: false,
        error: failure.message,
        code: failure.code,
        errorType: failure.errorType,
        model: probeModel,
        elapsedMs: op.elapsedMs(),
        estimatedCost: 0,
      };
    } finally {
      op.clear();
    }
  },

  estimateCost({ model, promptTokens, completionTokens }) {
    return estimateCost("anthropic", model, { promptTokens, completionTokens });
  },
};
