const { encrypt, decrypt } = require("../utils/encryption");
const { getProvider } = require("../providers");
const { DEFAULT_MODELS } = require("../providers/providerUtils");
const { validateModelForProvider } = require("./modelValidation");
const aiCredentialModel = require("../models/aiCredentialModel");
const { NonRetryableError } = require("../utils/errors");
const { canAutoRecoverHealth, isTerminalHealth } = require("./aiRetryPolicy");
const { logInfo } = require("../utils/logger");

const config = require("../config");

function resolvePlatformCredentials() {
  const provider = config.ai.DEFAULT_AI_PROVIDER;
  const apiKey = config.ai.openaiApiKey;
  if (!apiKey && provider === "openai") {
    return null;
  }
  return {
    provider,
    providerType: "remote",
    apiKey,
    model: config.ai.DEFAULT_AI_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
    baseUrl: null,
    credentialSource: "platform",
    allowPlatformFallback: true,
  };
}

function rowToCredential(row) {
  if (!row) return null;
  if (row.providerType === "local") {
    return {
      credentialId: row.id,
      provider: row.provider,
      providerType: "local",
      apiKey: null,
      model: row.selectedModel || null,
      baseUrl: row.baseUrl,
      credentialSource: "user",
      allowPlatformFallback: row.allowPlatformFallback,
      healthStatus: row.healthStatus,
      inFallbackChain: row.inFallbackChain,
      priority: row.priority,
      label: row.label,
    };
  }
  return {
    credentialId: row.id,
    provider: row.provider,
    providerType: "remote",
    apiKey: row.encryptedApiKey ? decrypt(row.encryptedApiKey) : null,
    model: row.selectedModel || null,
    baseUrl: row.baseUrl,
    credentialSource: "user",
    allowPlatformFallback: row.allowPlatformFallback,
    healthStatus: row.healthStatus,
    inFallbackChain: row.inFallbackChain,
    priority: row.priority,
    label: row.label,
  };
}

async function resolveCredentialsForUser(userId) {
  const chain = await resolveCredentialChainForUser(userId);
  if (chain.length) return chain[0];
  const platform = resolvePlatformCredentials();
  if (!platform?.apiKey) {
    throw new NonRetryableError("No AI credentials configured. Add your API key in Setup.");
  }
  return platform;
}

async function resolveCredentialChainForUser(userId, { includeDisabled = false } = {}) {
  const rows = await aiCredentialModel.listByUser(userId);
  const filtered = rows.filter((r) => {
    if (!includeDisabled && r.inFallbackChain === false) return false;
    return true;
  });

  return filtered.map((r) => rowToCredential(r)).filter(Boolean);
}

async function saveCredential(userId, payload) {
  const {
    provider,
    apiKey,
    selectedModel,
    baseUrl,
    label,
    allowPlatformFallback,
    providerType: inputType,
    role,
  } = payload;

  const adapter = getProvider(provider);
  const providerType = inputType || adapter.providerType || "remote";

  const validation = validateModelForProvider({
    provider,
    model: selectedModel,
    providerType,
    task: providerType === "local" ? null : "resume_parse",
  });
  if (!validation.valid) {
    const err = new Error(validation.message);
    err.code = validation.code;
    throw err;
  }

  if (providerType === "local" && !baseUrl) {
    const err = new Error("base_url is required for local providers");
    err.code = "LOCAL_BASE_URL_REQUIRED";
    throw err;
  }

  if (providerType === "remote" && !apiKey) {
    const err = new Error("API key is required for remote providers");
    err.code = "API_KEY_REQUIRED";
    throw err;
  }

  let encryptedApiKey = null;
  if (apiKey) encryptedApiKey = encrypt(apiKey);

  return aiCredentialModel.upsertCredential({
    userId,
    provider,
    providerType,
    encryptedApiKey,
    selectedModel: validation.model,
    baseUrl: baseUrl || null,
    label: label || provider,
    allowPlatformFallback: !!allowPlatformFallback,
    role: role || "primary",
  });
}

async function listCredentials(userId) {
  const rows = await aiCredentialModel.listByUser(userId);
  return rows.map(({ encryptedApiKey, ...rest }) => rest);
}

async function reorderCredentialChain(userId, orderedIds) {
  return aiCredentialModel.reorderChain(userId, orderedIds);
}

async function activateCredential(userId, credentialId) {
  return aiCredentialModel.promoteToPrimary(credentialId, userId);
}

async function removeCredential(userId, credentialId) {
  return aiCredentialModel.deleteCredential(credentialId, userId);
}

async function setInFallbackChain(userId, credentialId, inFallbackChain) {
  return aiCredentialModel.setInFallbackChain(credentialId, userId, inFallbackChain);
}

async function updateCredentialHealth(credentialId, userId, healthStatus, meta = {}) {
  const current = await aiCredentialModel.getById(credentialId, userId);
  if (!current) return null;

  const from = current.healthStatus;
  if (from === healthStatus) return current;

  if (isTerminalHealth(from) && healthStatus === "healthy" && !meta.allowTerminalClear) {
    return current;
  }

  const updated = await aiCredentialModel.updateHealth(credentialId, userId, healthStatus, {
    allowTerminalClear: meta.allowTerminalClear,
  });

  if (updated) {
    logInfo("AI_CHAIN_HEALTH_TRANSITION", {
      credentialId,
      from,
      to: healthStatus,
      trigger: meta.trigger || "gateway_error",
    });
  }

  return updated;
}

async function markCredentialSuccess(credentialId, userId) {
  const current = await aiCredentialModel.getById(credentialId, userId);
  if (!current) return;
  if (canAutoRecoverHealth(current.healthStatus)) {
    await updateCredentialHealth(credentialId, userId, "healthy", {
      trigger: "gateway_success",
    });
  }
}

module.exports = {
  resolveCredentialsForUser,
  resolveCredentialChainForUser,
  resolvePlatformCredentials,
  saveCredential,
  listCredentials,
  reorderCredentialChain,
  activateCredential,
  removeCredential,
  setInFallbackChain,
  updateCredentialHealth,
  markCredentialSuccess,
  rowToCredential,
};
