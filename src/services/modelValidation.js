const { REGISTRY } = require("../providers");
const { DEFAULT_MODELS, MODEL_PREFIXES } = require("../providers/providerUtils");

const TASK_CAPABILITIES = {
  resume_parse: ["supportsStructuredJson"],
  jd_parse: ["supportsStructuredJson"],
  email_generate: ["supportsStructuredJson"],
  health_check: [],
};

function modelMatchesProvider(provider, model) {
  if (!model || typeof model !== "string") return false;
  const prefixes = MODEL_PREFIXES[provider];
  if (!prefixes) return model.length >= 2;
  return prefixes.some((p) => model.startsWith(p) || model.includes(p));
}

function validateModelForProvider({ provider, model, providerType, task }) {
  if (!provider || !REGISTRY[provider]) {
    return { valid: false, code: "INVALID_PROVIDER", message: `Unknown provider: ${provider}` };
  }

  const adapter = REGISTRY[provider];

  if (providerType === "local" && task) {
    return { valid: false, code: "LOCAL_PROVIDER_NOT_IMPLEMENTED", message: "Local provider execution is not available yet" };
  }

  if (providerType === "local" && !task) {
    return { valid: true, model: model || null };
  }

  const resolvedModel = model || DEFAULT_MODELS[provider];
  if (!resolvedModel) {
    return { valid: false, code: "MODEL_REQUIRED", message: "Model is required for this provider" };
  }

  if (!modelMatchesProvider(provider, resolvedModel)) {
    return {
      valid: false,
      code: "INVALID_MODEL_FOR_PROVIDER",
      message: `Model "${resolvedModel}" is not valid for provider "${provider}"`,
    };
  }

  if (task && TASK_CAPABILITIES[task]) {
    for (const cap of TASK_CAPABILITIES[task]) {
      if (!adapter.capabilities?.[cap]) {
        return {
          valid: false,
          code: "CAPABILITY_NOT_SUPPORTED",
          message: `Provider "${provider}" does not support ${cap} for task ${task}`,
        };
      }
    }
  }

  return { valid: true, model: resolvedModel };
}

module.exports = {
  validateModelForProvider,
  modelMatchesProvider,
  TASK_CAPABILITIES,
};
