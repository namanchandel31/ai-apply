const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { normalizeModelInput } = require("../utils/normalizeModelInput");
const { logInfo, logError } = require("../utils/logger");
const {
  parseJsonFromText,
  normalizeUsage,
  classifyProviderError,
  DEFAULT_MODELS,
} = require("./providerUtils");
const { estimateCost } = require("../config/providerPricing");
const { NonRetryableError } = require("../utils/errors");

async function geminiGenerate({ apiKey, model, systemPrompt, userPrompt, jsonMode, signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0 },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  if (jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

module.exports = {
  id: "gemini",
  providerType: "remote",
  adapterVersion: "1.0.0",
  capabilities: REMOTE_PARSE_CAPABILITIES,

  async generateStructuredJson({ systemPrompt, userPrompt, model, credentials, signal }) {
    const startedAt = Date.now();
    const apiKey = credentials?.apiKey;
    if (!apiKey) throw new NonRetryableError("Gemini API key required");
    const resolvedModel = model || credentials?.model || DEFAULT_MODELS.gemini;

    try {
      const data = await geminiGenerate({
        apiKey,
        model: resolvedModel,
        systemPrompt,
        userPrompt,
        jsonMode: true,
        signal,
      });

      const text = extractGeminiText(data);
      const parsed = parseJsonFromText(text);
      const meta = data.usageMetadata || {};
      const usage = normalizeUsage({
        prompt_tokens: meta.promptTokenCount,
        completion_tokens: meta.candidatesTokenCount,
      });

      return {
        parsed,
        text: null,
        raw: data,
        usage,
        model: resolvedModel,
        provider: "gemini",
        latencyMs: Date.now() - startedAt,
        estimatedCost: estimateCost("gemini", resolvedModel, usage),
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  },

  async generateText(args) {
    const result = await this.generateStructuredJson(args);
    return { ...result, parsed: null, text: JSON.stringify(result.parsed) };
  },

  async healthCheck({ credentials, model }) {
    const apiKey = credentials?.apiKey;
    if (!apiKey) return { ok: false, error: "Missing API key" };
    const normalized = normalizeModelInput(model ?? credentials?.model, { required: true });
    if (!normalized.ok) {
      return { ok: false, error: normalized.message, code: normalized.code, estimatedCost: 0 };
    }
    const probeModel = normalized.model;
    logInfo("AI_MODEL_HEALTH_CHECK", { provider: "gemini", model: probeModel, method: "minimal_generate" });

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || "5000", 10)
    );
    try {
      await geminiGenerate({
        apiKey,
        model: probeModel,
        userPrompt: "hi",
        jsonMode: false,
        signal: controller.signal,
      });
      return { ok: true, method: "minimal_generate", model: probeModel, estimatedCost: 0 };
    } catch (err) {
      logError("AI_MODEL_PROVIDER_ERROR", err, {
        provider: "gemini",
        model: probeModel,
        statusCode: err.status,
      });
      const isModelError =
        err.status === 404 ||
        err.message?.toLowerCase().includes("model");
      if (isModelError) {
        logInfo("AI_MODEL_INVALID", { provider: "gemini", model: probeModel });
      }
      return {
        ok: false,
        error: err.message,
        code: isModelError ? "AI_MODEL_INVALID" : "PROVIDER_ERROR",
        model: probeModel,
        estimatedCost: 0,
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  estimateCost({ model, promptTokens, completionTokens }) {
    return estimateCost("gemini", model, { promptTokens, completionTokens });
  },
};
