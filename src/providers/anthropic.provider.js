const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
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

  async healthCheck({ credentials }) {
    const apiKey = credentials?.apiKey;
    if (!apiKey) return { ok: false, error: "Missing API key" };
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || "5000", 10)
    );
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: credentials?.model || DEFAULT_MODELS.anthropic,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: controller.signal,
      });
      return { ok: res.ok || res.status === 400, method: "minimal_message", estimatedCost: 0 };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      clearTimeout(timeout);
    }
  },

  estimateCost({ model, promptTokens, completionTokens }) {
    return estimateCost("anthropic", model, { promptTokens, completionTokens });
  },
};
