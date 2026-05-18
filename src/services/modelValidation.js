const { REGISTRY } = require("../providers");
const { normalizeModelInput } = require("../utils/normalizeModelInput");

const TASK_CAPABILITIES = {
  resume_parse: ["supportsStructuredJson"],
  jd_parse: ["supportsStructuredJson"],
  email_generate: ["supportsStructuredJson"],
  health_check: [],
};

function validateModelForProvider({ provider, model, providerType, task }) {
  if (!provider || !REGISTRY[provider]) {
    return { valid: false, code: "INVALID_PROVIDER", message: `Unknown provider: ${provider}` };
  }

  const adapter = REGISTRY[provider];

  if (providerType === "local" && task) {
    return { valid: false, code: "LOCAL_PROVIDER_NOT_IMPLEMENTED", message: "Local provider execution is not available yet" };
  }

  if (providerType === "local" && !task) {
    const localNorm = normalizeModelInput(model, { required: false });
    if (!localNorm.ok) {
      return { valid: false, code: localNorm.code, message: localNorm.message };
    }
    return { valid: true, model: localNorm.model };
  }

  const normalized = normalizeModelInput(model, { required: true });
  if (!normalized.ok) {
    return { valid: false, code: normalized.code, message: normalized.message };
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

  return {
    valid: true,
    model: normalized.model,
    ...(normalized.normalizedFrom ? { normalizedFrom: normalized.normalizedFrom } : {}),
  };
}

module.exports = {
  validateModelForProvider,
  TASK_CAPABILITIES,
};
