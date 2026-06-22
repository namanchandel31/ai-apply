const { extractOpenAIResponse } = require("../utils/openaiHelper");
const { HEALTH_CHECK_TIMEOUT_MS } = require("../config/aiTimeoutConfig");
const { normalizeModelInput } = require("../utils/normalizeModelInput");
const {
  createOperationTimeout,
  classifyHealthCheckError,
} = require("../utils/operationTimeout");
const { logInfo, logError } = require("../utils/logger");
const { RetryableError } = require("../utils/errors");
const {
  buildOpenAICompatibleClient,
  normalizeUsage,
  parseJsonFromText,
  classifyProviderError,
} = require("./providerUtils");
const { estimateCost } = require("../config/providerPricing");

/**
 * Shared OpenAI-compatible adapter (OpenAI, OpenRouter, Grok, Groq, NVIDIA NIM).
 */
const ADAPTER_VERSION = "1.0.0";
const STRUCTURED_JSON_ATTEMPTS = 3;

function buildStructuredJsonStrategies(providerId) {
  if (providerId === "groq") {
    // Groq Responses API JSON mode fails often; fall back to chat.completions sooner.
    return [
      { api: "responses" },
      { api: "chat_completions" },
      { api: "chat_completions" },
    ];
  }
  return Array.from({ length: STRUCTURED_JSON_ATTEMPTS }, () => ({
    api: "responses",
  }));
}

async function invokeStructuredJson(client, { api, model, systemPrompt, userPrompt, signal }) {
  if (api === "chat_completions") {
    const response = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { signal }
    );
    const content = response.choices?.[0]?.message?.content?.trim();
    return {
      parsed: parseJsonFromText(content),
      raw: response,
      usage: normalizeUsage(response.usage || {}),
    };
  }

  const response = await client.responses.create(
    {
      model,
      temperature: 0,
      text: { format: { type: "json_object" } },
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    { signal }
  );
  return {
    parsed: extractOpenAIResponse(response),
    raw: response,
    usage: normalizeUsage(response.usage || {}),
  };
}

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

      const strategies = buildStructuredJsonStrategies(id);
      let lastError;

      for (let attempt = 0; attempt < strategies.length; attempt++) {
        const strategy = strategies[attempt];
        try {
          const { parsed, raw, usage } = await invokeStructuredJson(client, {
            api: strategy.api,
            model: resolvedModel,
            systemPrompt,
            userPrompt,
            signal,
          });
          const latencyMs = Date.now() - startedAt;

          if (attempt > 0) {
            logInfo("AI_STRUCTURED_JSON_RETRY_SUCCESS", {
              provider: id,
              model: resolvedModel,
              attempt: attempt + 1,
              api: strategy.api,
            });
          }

          return {
            parsed,
            text: null,
            raw,
            usage,
            model: resolvedModel,
            provider: id,
            latencyMs,
            estimatedCost: estimateCost(id, resolvedModel, usage),
          };
        } catch (err) {
          const classified = classifyProviderError(err);
          lastError = classified;
          const canRetry =
            classified instanceof RetryableError && attempt < strategies.length - 1;
          if (!canRetry) throw classified;

          logInfo("AI_STRUCTURED_JSON_RETRY", {
            provider: id,
            model: resolvedModel,
            attempt: attempt + 1,
            nextApi: strategies[attempt + 1]?.api,
            reason: classified.message,
          });
        }
      }

      throw lastError || new Error("Structured JSON generation failed");
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
      const normalized = normalizeModelInput(model ?? credentials?.model, { required: true });
      if (!normalized.ok) {
        return { ok: false, error: normalized.message, code: normalized.code, estimatedCost: 0 };
      }
      const probeModel = normalized.model;
      const timeoutMs = HEALTH_CHECK_TIMEOUT_MS;
      logInfo("AI_MODEL_HEALTH_CHECK", {
        provider: id,
        model: probeModel,
        method: "minimal_completion",
        operationType: "health_check",
        timeoutMs,
      });

      const client = buildOpenAICompatibleClient({ apiKey, baseUrl });
      const op = createOperationTimeout(timeoutMs, {
        operationType: "health_check",
        provider: id,
        model: probeModel,
      });
      try {
        await client.responses.create(
          {
            model: probeModel,
            max_output_tokens: 1,
            input: [{ role: "user", content: "ping" }],
          },
          { signal: op.signal }
        );
        return {
          ok: true,
          method: "minimal_completion",
          model: probeModel,
          elapsedMs: op.elapsedMs(),
          estimatedCost: 0,
        };
      } catch (err) {
        const failure = classifyHealthCheckError(err, {
          timeoutMs,
          elapsedMs: op.elapsedMs(),
          provider: id,
          wasTimedOut: op.wasTimedOut(),
        });
        logError("AI_MODEL_PROVIDER_ERROR", err, {
          provider: id,
          model: probeModel,
          operationType: "health_check",
          timeoutMs,
          elapsedMs: op.elapsedMs(),
          errorType: failure.errorType,
          code: failure.code,
          statusCode: err.status,
          providerCode: err.code || err.error?.code,
        });
        if (failure.code === "AI_MODEL_INVALID") {
          logInfo("AI_MODEL_INVALID", { provider: id, model: probeModel });
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
      } finally {
        op.clear();
      }
    },

    estimateCost({ model, promptTokens, completionTokens }) {
      return estimateCost(id, model, { promptTokens, completionTokens });
    },
  };
}

module.exports = { createOpenAICompatibleProvider };
