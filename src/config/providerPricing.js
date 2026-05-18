/**
 * Provider/model pricing registry — isolated from logger and gateway logic.
 * Update rates here when providers change pricing.
 */

const PRICING_TABLE = {
  openai: {
    "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6, currency: "USD" },
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, currency: "USD" },
  },
  openrouter: {
    default: { inputPer1M: 0.5, outputPer1M: 1.5, currency: "USD" },
  },
  anthropic: {
    "claude-3-5-haiku-20241022": { inputPer1M: 0.8, outputPer1M: 4.0, currency: "USD" },
    default: { inputPer1M: 3.0, outputPer1M: 15.0, currency: "USD" },
  },
  gemini: {
    "gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4, currency: "USD" },
    default: { inputPer1M: 0.35, outputPer1M: 1.05, currency: "USD" },
  },
  grok: {
    default: { inputPer1M: 0.5, outputPer1M: 1.5, currency: "USD" },
  },
  nvidia: {
    default: { inputPer1M: 0.2, outputPer1M: 0.2, currency: "USD" },
  },
};

function getModelPricing(provider, model) {
  const providerTable = PRICING_TABLE[provider];
  if (!providerTable) return null;
  if (model && providerTable[model]) return providerTable[model];
  return providerTable.default || null;
}

function estimateCost(provider, model, { promptTokens = 0, completionTokens = 0 } = {}) {
  const rates = getModelPricing(provider, model);
  if (!rates) return null;
  const inputCost = (promptTokens / 1_000_000) * rates.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * rates.outputPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

function registerPricing(provider, model, rates) {
  if (!PRICING_TABLE[provider]) PRICING_TABLE[provider] = {};
  PRICING_TABLE[provider][model] = rates;
}

module.exports = {
  getModelPricing,
  estimateCost,
  registerPricing,
  PRICING_TABLE,
};
