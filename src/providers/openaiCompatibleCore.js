const { extractOpenAIResponse } = require("../utils/openaiHelper");
const {
  buildOpenAICompatibleClient,
  normalizeUsage,
  parseJsonFromText,
  classifyProviderError,
} = require("./providerUtils");
const { estimateCost } = require("../config/providerPricing");

/**
 * Shared OpenAI-compatible adapter (OpenAI, OpenRouter, Grok, NVIDIA NIM).
 */
const ADAPTER_VERSION = "1.0.0";

function createOpenAICompatibleProvider({ id, providerType = "remote", defaultBaseUrl, capabilities }) {
  return {
    id,
    providerType,
    adapterVersion: ADAPTER_VERSION,
    capabilities,

    async generateStructuredJson({
      systemPrompt,
      userPrompt,
      model,
      credentials,
      signal,
    }) {
      const startedAt = Date.now();
      const apiKey = credentials?.apiKey;
      const baseUrl = credentials?.baseUrl || defaultBaseUrl;
      const client = buildOpenAICompatibleClient({ apiKey, baseUrl });
      const resolvedModel = model || credentials?.model;

      try {
        const response = await client.responses.create(
          {
            model: resolvedModel,
            temperature: 0,
            text: { format: { type: "json_object" } },
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          },
          { signal }
        );

        const parsed = extractOpenAIResponse(response);
        const usage = normalizeUsage(response.usage || {});
        const latencyMs = Date.now() - startedAt;

        return {
          parsed,
          text: null,
          raw: response,
          usage,
          model: resolvedModel,
          provider: id,
          latencyMs,
          estimatedCost: estimateCost(id, resolvedModel, usage),
        };
      } catch (err) {
        throw classifyProviderError(err);
      }
    },

    async generateText({ systemPrompt, userPrompt, model, credentials, signal }) {
      const startedAt = Date.now();
      const apiKey = credentials?.apiKey;
      const baseUrl = credentials?.baseUrl || defaultBaseUrl;
      const client = buildOpenAICompatibleClient({ apiKey, baseUrl });
      const resolvedModel = model || credentials?.model;

      try {
        const response = await client.responses.create(
          {
            model: resolvedModel,
            temperature: 0,
            input: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          },
          { signal }
        );

        const text =
          response.output_text?.trim() ||
          response.output
            ?.flatMap((o) => o.content || [])
            ?.find((c) => c.type === "output_text")
            ?.text
            ?.trim() ||
          "";

        if (!text) throw new Error("Empty text response");

        const usage = normalizeUsage(response.usage || {});
        return {
          parsed: null,
          text,
          raw: response,
          usage,
          model: resolvedModel,
          provider: id,
          latencyMs: Date.now() - startedAt,
          estimatedCost: estimateCost(id, resolvedModel, usage),
        };
      } catch (err) {
        throw classifyProviderError(err);
      }
    },

    async healthCheck({ credentials, model }) {
      const apiKey = credentials?.apiKey;
      const baseUrl = credentials?.baseUrl || defaultBaseUrl;
      const client = buildOpenAICompatibleClient({ apiKey, baseUrl });
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || "5000", 10)
      );
      try {
        if (typeof client.models?.list === "function") {
          await client.models.list({ signal: controller.signal });
          return { ok: true, method: "models_list", estimatedCost: 0 };
        }
        await client.responses.create(
          {
            model: model || credentials?.model,
            max_output_tokens: 1,
            input: [{ role: "user", content: "ping" }],
          },
          { signal: controller.signal }
        );
        return { ok: true, method: "minimal_completion", estimatedCost: 0 };
      } catch (err) {
        return { ok: false, error: err.message, estimatedCost: 0 };
      } finally {
        clearTimeout(timeout);
      }
    },

    estimateCost({ model, promptTokens, completionTokens }) {
      return estimateCost(id, model, { promptTokens, completionTokens });
    },
  };
}

module.exports = { createOpenAICompatibleProvider };
