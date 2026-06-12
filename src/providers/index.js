const openai = require("./openai.provider");
const openrouter = require("./openrouter.provider");
const anthropic = require("./anthropic.provider");
const gemini = require("./gemini.provider");
const grok = require("./grok.provider");
const groq = require("./groq.provider");
const nvidia = require("./nvidia.provider");
const ollama = require("./ollama.provider");
const lmstudio = require("./lmstudio.provider");

const REGISTRY = {
  openai,
  openrouter,
  anthropic,
  gemini,
  grok,
  groq,
  nvidia,
  ollama,
  lmstudio,
};

const REMOTE_IDS = ["openai", "openrouter", "anthropic", "gemini", "grok", "groq", "nvidia"];
const LOCAL_IDS = ["ollama", "lmstudio"];

function getProvider(id) {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}

function listRemoteProviders() {
  return REMOTE_IDS.map((id) => ({
    id,
    providerType: "remote",
    billingModel: "byok",
    adapterVersion: REGISTRY[id].adapterVersion || "1.0.0",
    capabilities: REGISTRY[id].capabilities,
  }));
}

function listLocalProviders() {
  return LOCAL_IDS.map((id) => ({
    id,
    providerType: "local",
    capabilities: REGISTRY[id].capabilities,
    implemented: false,
  }));
}

function listAllProviders() {
  return [...listRemoteProviders(), ...listLocalProviders()];
}

module.exports = {
  getProvider,
  listRemoteProviders,
  listLocalProviders,
  listAllProviders,
  REGISTRY,
};
