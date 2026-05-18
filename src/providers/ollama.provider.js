const { LOCAL_STUB_CAPABILITIES } = require("./capabilities");
const { NonRetryableError } = require("../utils/errors");

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: controller.signal });
      return { ok: res.ok, method: "ollama_tags", estimatedCost: 0 };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      clearTimeout(timeout);
    }
  },

  estimateCost() {
    return 0;
  },
};
