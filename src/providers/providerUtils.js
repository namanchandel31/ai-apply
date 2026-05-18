const crypto = require("crypto");
const OpenAI = require("openai");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { safeParseJSON } = require("../utils/openaiHelper");

function parseJsonFromText(text) {
  if (!text || !String(text).trim()) {
    throw new RetryableError("Empty response from provider");
  }
  const content = String(text).trim();
  let parsed = safeParseJSON(content);
  if (!parsed) {
    const stripped = content.replace(/```json\s*|```\s*/g, "").trim();
    parsed = safeParseJSON(stripped);
  }
  if (!parsed) throw new RetryableError("Invalid JSON response from provider");
  return parsed;
}

function buildOpenAICompatibleClient({ apiKey, baseUrl }) {
  if (!apiKey) throw new NonRetryableError("API key required for remote provider");
  const opts = { apiKey };
  if (baseUrl) opts.baseURL = baseUrl;
  return new OpenAI(opts);
}

function normalizeUsage(raw = {}) {
  const promptTokens = raw.prompt_tokens ?? raw.input_tokens ?? raw.promptTokens ?? 0;
  const completionTokens = raw.completion_tokens ?? raw.output_tokens ?? raw.completionTokens ?? 0;
  const totalTokens = raw.total_tokens ?? raw.totalTokens ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function computePromptHash(systemPrompt, userPrompt) {
  const payload = `${systemPrompt || ""}\n---\n${userPrompt || ""}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function classifyProviderError(err) {
  if (err instanceof NonRetryableError || err instanceof RetryableError) return err;
  if (err.name === "AbortError") return new RetryableError(`Request aborted: ${err.message}`);
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(err.code)) {
    return new RetryableError(err.message);
  }
  if (err.status === 401 || err.status === 403) {
    return new NonRetryableError(`Authentication failed: ${err.message}`);
  }
  if (err.status === 400) {
    return new NonRetryableError(`Malformed request: ${err.message}`);
  }
  const isQuota = err.status === 429 && (
    err.error?.code === "insufficient_quota" ||
    err.code === "insufficient_quota" ||
    err.message?.includes("quota")
  );
  if (isQuota) return new NonRetryableError(`Quota exhausted: ${err.message}`);
  if (err.status && [429, 500, 502, 503, 504].includes(err.status)) {
    return new RetryableError(`Transient provider error: ${err.message}`);
  }
  return new NonRetryableError(err.message || "Unknown provider error");
}

const DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  openrouter: "openai/gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini: "gemini-2.0-flash",
  grok: "grok-2-latest",
  nvidia: "meta/llama-3.1-8b-instruct",
};

module.exports = {
  parseJsonFromText,
  buildOpenAICompatibleClient,
  normalizeUsage,
  computePromptHash,
  classifyProviderError,
  DEFAULT_MODELS,
};
