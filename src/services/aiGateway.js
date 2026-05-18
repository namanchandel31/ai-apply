/**
 * AI Gateway — temporary orchestration layer (see docs/AI_GATEWAY.md).
 * Business logic must NEVER import provider SDKs; only this module invokes providers.
 */

const { pool } = require("../db");
const { getProvider } = require("../providers");
const { estimateCost } = require("../config/providerPricing");
const { computePromptHash } = require("../providers/providerUtils");
const { validateModelForProvider } = require("./modelValidation");
const { normalizeModelInput } = require("../utils/normalizeModelInput");
const {
  resolveCredentialsForUser,
  resolveCredentialChainForUser,
  resolvePlatformCredentials,
  updateCredentialHealth,
  markCredentialSuccess,
} = require("./aiCredentialService");
const { createExecutionContext } = require("./aiExecutionContext");
const {
  classifyExecutionFailure,
  shouldSkipCredentialForHealth,
} = require("./aiRetryPolicy");
const llmProtection = require("./llmProtection");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { LLM_TIMEOUT_MS } = require("../config/parsingConfig");

const EMAIL_LLM_TIMEOUT_MS = parseInt(process.env.EMAIL_LLM_TIMEOUT_MS || "10000", 10);
const HEALTH_CHECK_CACHE_TTL_MS = parseInt(process.env.HEALTH_CHECK_CACHE_TTL_MS || "60000", 10);
const healthCache = new Map();

const TASK_TIMEOUTS = {
  resume_parse: LLM_TIMEOUT_MS,
  jd_parse: LLM_TIMEOUT_MS,
  email_generate: EMAIL_LLM_TIMEOUT_MS,
  health_check: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || "5000", 10),
};

// =============================================================================
// SECTION: Credential Resolution
// =============================================================================

async function resolveCredentialContext(userId, executionContext, options = {}) {
  if (executionContext?.getCredentialChain) {
    const chain = await executionContext.getCredentialChain();
    if (chain.length) return chain[0];
  }

  try {
    const primary = await resolveCredentialsForUser(userId);
    return primary;
  } catch (err) {
    if (options.allowPlatformFallback !== false) {
      const platform = resolvePlatformCredentials();
      if (platform?.apiKey) return platform;
    }
    throw err;
  }
}

async function buildUserCredentialAttempts(userId, executionContext, task) {
  let chain;
  if (executionContext?.getCredentialChain) {
    chain = await executionContext.getCredentialChain();
  } else {
    chain = await resolveCredentialChainForUser(userId);
  }

  const attempts = [];
  let disabledCount = 0;

  const allRows = await resolveCredentialChainForUser(userId, { includeDisabled: true });
  disabledCount = allRows.filter((c) => c.inFallbackChain === false).length;

  for (const cred of chain) {
    if (cred.inFallbackChain === false) {
      logInfo("AI_CHAIN_SKIP", {
        credentialId: cred.credentialId,
        skipReason: "disabled",
        provider: cred.provider,
      });
      continue;
    }

    if (shouldSkipCredentialForHealth(cred.healthStatus)) {
      logInfo("AI_CHAIN_SKIP", {
        credentialId: cred.credentialId,
        skipReason: `invalid_health_${cred.healthStatus}`,
        provider: cred.provider,
      });
      continue;
    }

    const validation = validateModelForProvider({
      provider: cred.provider,
      model: cred.model,
      providerType: cred.providerType,
      task,
    });

    if (!validation.valid) {
      logInfo("AI_CHAIN_SKIP", {
        credentialId: cred.credentialId,
        skipReason: "capability_mismatch",
        provider: cred.provider,
        code: validation.code,
      });
      continue;
    }

    attempts.push({ ...cred, model: validation.model });
  }

  logInfo("AI_CHAIN_RESOLVED", {
    userId,
    chainLength: attempts.length,
    credentialIds: attempts.map((a) => a.credentialId),
    disabledCount,
  });

  return attempts;
}

function buildPlatformFallbackChain() {
  const raw = process.env.AI_PLATFORM_FALLBACK_PROVIDERS || "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length) return list;
  const primary = process.env.DEFAULT_AI_PROVIDER || "openai";
  return [primary];
}

function getPlatformCredentialForProvider(provider) {
  const platform = resolvePlatformCredentials();
  if (!platform?.apiKey) return null;
  return { ...platform, provider, credentialSource: "platform" };
}

// =============================================================================
// SECTION: Model Validation
// =============================================================================

function validateExecutionRequest(credentials, task, model) {
  if (credentials.providerType === "local") {
    throw new NonRetryableError("LOCAL_PROVIDER_NOT_IMPLEMENTED: Local AI execution is not available yet");
  }
  const validation = validateModelForProvider({
    provider: credentials.provider,
    model: model || credentials.model,
    providerType: credentials.providerType,
    task,
  });
  if (!validation.valid) {
    throw new NonRetryableError(`${validation.code}: ${validation.message}`);
  }
  return validation.model;
}

function checkProtection() {
  const circuit = llmProtection.checkCircuit();
  if (!circuit.allowed) {
    throw new RetryableError(circuit.reason || "LLM circuit open");
  }
}

async function executeOnProvider({
  credentials,
  task,
  systemPrompt,
  userPrompt,
  model,
  signal,
  structured,
}) {
  const adapter = getProvider(credentials.provider);
  const creds = { ...credentials };
  const resolvedModel = model || credentials.model;

  if (structured) {
    return adapter.generateStructuredJson({
      systemPrompt,
      userPrompt,
      model: resolvedModel,
      credentials: creds,
      signal,
    });
  }
  return adapter.generateText({
    systemPrompt,
    userPrompt,
    model: resolvedModel,
    credentials: creds,
    signal,
  });
}

// =============================================================================
// SECTION: Fallback Handling
// =============================================================================

async function executeWithFallback({
  userId,
  credentials: primaryCreds,
  task,
  systemPrompt,
  userPrompt,
  model,
  signal,
  structured,
  executionContext,
  reqId,
  jobId,
}) {
  const userAttempts = await buildUserCredentialAttempts(userId, executionContext, task);
  const allowPlatformFallback = primaryCreds?.allowPlatformFallback ?? userAttempts[0]?.allowPlatformFallback;

  let attempts = userAttempts;
  if (!attempts.length && primaryCreds?.credentialSource === "platform") {
    attempts = buildPlatformFallbackChain().map((provider) => {
      const platform = resolvePlatformCredentials();
      return { ...platform, provider, credentialSource: "platform" };
    });
  }

  if (!attempts.length) {
    const platform = resolvePlatformCredentials();
    if (platform?.apiKey) {
      attempts = [{ ...platform, credentialSource: "platform" }];
    }
  }

  const platformProviders = buildPlatformFallbackChain();
  let lastError;
  let lastCredentialId = null;

  for (let i = 0; i < attempts.length; i++) {
    const attemptCreds = attempts[i];

    const chainModel = attemptCreds.model;
    logInfo("AI_CHAIN_ATTEMPT", {
      reqId,
      jobId,
      credentialId: attemptCreds.credentialId,
      provider: attemptCreds.provider,
      model: chainModel,
      fallbackIndex: i,
      credentialSource: attemptCreds.credentialSource,
      healthStatus: attemptCreds.healthStatus,
    });

    try {
      const resolvedModel = validateExecutionRequest(attemptCreds, task, model);
      logInfo("AI_MODEL_EXECUTION", {
        reqId,
        jobId,
        task,
        provider: attemptCreds.provider,
        model: resolvedModel,
        credentialId: attemptCreds.credentialId,
      });
      const result = await executeOnProvider({
        credentials: { ...attemptCreds, model: resolvedModel },
        task,
        systemPrompt,
        userPrompt,
        model: resolvedModel,
        signal,
        structured,
      });

      if (attemptCreds.credentialId && userId) {
        markCredentialSuccess(attemptCreds.credentialId, userId);
      }

      return {
        result,
        credentials: attemptCreds,
        fallbackIndex: i,
      };
    } catch (err) {
      const classified = classifyExecutionFailure(err);
      lastError = classified.error;

      if (attemptCreds.credentialId && classified.healthTransition && userId) {
        await updateCredentialHealth(attemptCreds.credentialId, userId, classified.healthTransition, {
          trigger: "gateway_error",
        });
      }

      const hasMoreUser = i < attempts.length - 1;
      const canRetry = classified.retryable && hasMoreUser && llmProtection.consumeRetryBudget();

      logInfo("AI_MODEL_PROVIDER_ERROR", {
        reqId,
        provider: attemptCreds.provider,
        model: attemptCreds.model,
        logCode: classified.logCode,
        retryable: classified.retryable,
      });

      if (hasMoreUser && canRetry) {
        logInfo("AI_CHAIN_FALLBACK", {
          reqId,
          fromCredentialId: attemptCreds.credentialId,
          toCredentialId: attempts[i + 1]?.credentialId,
          fromModel: attemptCreds.model,
          toModel: attempts[i + 1]?.model,
          reason: classified.logCode,
          retryable: classified.retryable,
        });
        lastCredentialId = attemptCreds.credentialId;
        continue;
      }

      if (err instanceof NonRetryableError && !classified.retryable) throw classified.error;
    }
  }

  if (
    allowPlatformFallback &&
    attempts.length &&
    attempts[0].credentialSource === "user"
  ) {
    for (const provider of platformProviders) {
      const platformCreds = getPlatformCredentialForProvider(provider);
      if (!platformCreds) continue;

      logInfo("AI_CHAIN_ATTEMPT", {
        reqId,
        credentialId: null,
        provider: platformCreds.provider,
        fallbackIndex: attempts.length,
        credentialSource: "platform",
      });

      try {
        const resolvedModel = validateExecutionRequest(platformCreds, task, model);
        const result = await executeOnProvider({
          credentials: { ...platformCreds, model: resolvedModel },
          task,
          systemPrompt,
          userPrompt,
          model: resolvedModel,
          signal,
          structured,
        });
        return {
          result,
          credentials: platformCreds,
          fallbackIndex: attempts.length,
        };
      } catch (platformErr) {
        lastError = classifyExecutionFailure(platformErr).error;
      }
    }
  }

  logInfo("AI_CHAIN_EXHAUSTED", {
    userId,
    reqId,
    attemptCount: attempts.length,
    platformFallbackAllowed: !!allowPlatformFallback,
    lastCredentialId,
  });

  throw lastError || new RetryableError("All provider attempts failed");
}

// =============================================================================
// SECTION: Telemetry
// =============================================================================

async function recordTelemetry(payload) {
  try {
    const {
      userId,
      provider,
      model,
      endpoint,
      credentialSource,
      usage,
      estimatedCost,
      latencyMs,
      retries,
      success,
      errorCode,
      reqId,
      promptVersion,
      promptHash,
    } = payload;

    await pool.query(
      `INSERT INTO llm_usage_logs (
        user_id, provider, model, endpoint, credential_source,
        prompt_tokens, completion_tokens, total_tokens, estimated_cost,
        latency_ms, retries, success, error_code, req_id, prompt_version, prompt_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        userId || null,
        provider,
        model,
        endpoint || null,
        credentialSource || "platform",
        usage?.promptTokens || 0,
        usage?.completionTokens || 0,
        usage?.totalTokens || 0,
        estimatedCost,
        latencyMs,
        retries || 0,
        success,
        errorCode || null,
        reqId || null,
        promptVersion || null,
        promptHash || null,
      ]
    );
  } catch (err) {
    logError("LLM_TELEMETRY_WRITE_FAILED", err, { provider: payload.provider, model: payload.model });
  }
}

// =============================================================================
// SECTION: Health Checks
// =============================================================================

function healthCacheKey(userId, provider, credentialId) {
  return `${userId}:${provider}:${credentialId || "default"}`;
}

async function healthCheck({ userId, provider, credentialId, model, apiKey, baseUrl, providerType }) {
  const cacheKey = healthCacheKey(userId || "anon", provider, credentialId);
  const cached = healthCache.get(cacheKey);
  if (cached && Date.now() - cached.at < HEALTH_CHECK_CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  let credentials;
  let probeModel = model;
  if (probeModel != null) {
    const normalized = normalizeModelInput(probeModel, { required: providerType !== "local" });
    if (!normalized.ok) {
      return { ok: false, error: normalized.message, code: normalized.code, estimatedCost: 0 };
    }
    probeModel = normalized.model;
  }

  if (apiKey !== undefined || baseUrl) {
    credentials = {
      provider,
      providerType: providerType || "remote",
      apiKey: apiKey || null,
      model: probeModel,
      baseUrl,
    };
  } else if (userId && credentialId) {
    const aiCredentialModel = require("../models/aiCredentialModel");
    const row = await aiCredentialModel.getById(credentialId, userId);
    const { rowToCredential } = require("./aiCredentialService");
    credentials = rowToCredential(row);
  } else if (userId) {
    credentials = await resolveCredentialsForUser(userId);
    if (provider) credentials = { ...credentials, provider };
  } else {
    credentials = resolvePlatformCredentials();
  }

  const adapter = getProvider(credentials.provider);
  let resolvedProbe = probeModel;
  if (!resolvedProbe && credentials.model) {
    const credNorm = normalizeModelInput(credentials.model, {
      required: credentials.providerType !== "local",
    });
    if (!credNorm.ok) {
      return { ok: false, error: credNorm.message, code: credNorm.code, estimatedCost: 0 };
    }
    resolvedProbe = credNorm.model;
  }
  if (credentials.providerType !== "local" && !resolvedProbe) {
    return { ok: false, error: "Model is required", code: "MODEL_REQUIRED", estimatedCost: 0 };
  }
  const result = await adapter.healthCheck({
    credentials: { ...credentials, model: resolvedProbe },
    model: resolvedProbe,
  });

  if (userId && credentialId && result.ok) {
    await updateCredentialHealth(credentialId, userId, "healthy", {
      allowTerminalClear: true,
      trigger: "health_check",
    });
  }

  healthCache.set(cacheKey, { at: Date.now(), result });
  return result;
}

// =============================================================================
// Public API
// =============================================================================

async function runGatewayRequest(params, structured = true) {
  const {
    userId,
    task,
    systemPrompt,
    userPrompt,
    promptVersion,
    model,
    timeoutMs,
    signal: parentSignal,
    reqId,
    jobId,
    endpoint,
    executionContext: providedContext,
  } = params;

  if (!userId) throw new NonRetryableError("userId is required for AI gateway calls");

  const executionContext =
    providedContext || createExecutionContext({ userId, reqId, jobId });

  const promptHash = computePromptHash(systemPrompt, userPrompt);
  const timeout = timeoutMs || TASK_TIMEOUTS[task] || LLM_TIMEOUT_MS;
  const startedAt = Date.now();
  let retries = 0;

  checkProtection();

  const internalController = new AbortController();
  const timeoutId = setTimeout(() => internalController.abort(), timeout);
  const signal = parentSignal || internalController.signal;

  if (parentSignal?.aborted) {
    clearTimeout(timeoutId);
    throw new RetryableError("Request aborted before start");
  }
  if (parentSignal) {
    parentSignal.addEventListener("abort", () => internalController.abort(), { once: true });
  }

  try {
    const credentials = await resolveCredentialContext(userId, executionContext);
    const { result, credentials: usedCreds, fallbackIndex } = await executeWithFallback({
      userId,
      credentials,
      task,
      systemPrompt,
      userPrompt,
      model,
      signal,
      structured,
      executionContext,
      reqId,
      jobId,
    });

    retries = fallbackIndex;
    const latencyMs = Date.now() - startedAt;
    llmProtection.recordSuccess(latencyMs);

    recordTelemetry({
      userId,
      provider: result.provider,
      model: result.model,
      endpoint: endpoint || task,
      credentialSource: usedCreds.credentialSource,
      usage: result.usage,
      estimatedCost: result.estimatedCost,
      latencyMs,
      retries,
      success: true,
      reqId,
      promptVersion,
      promptHash,
    });

    logInfo("ai_gateway_success", {
      reqId,
      jobId,
      task,
      provider: result.provider,
      model: result.model,
      credentialSource: usedCreds.credentialSource,
      credentialId: usedCreds.credentialId,
      latencyMs,
    });

    return structured ? result.parsed : result;
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    if (err instanceof RetryableError) {
      llmProtection.recordTransientFailure(latencyMs);
    } else {
      llmProtection.recordNonRetryableFailure(latencyMs);
    }

    recordTelemetry({
      userId,
      provider: model ? undefined : process.env.DEFAULT_AI_PROVIDER,
      model,
      endpoint: endpoint || task,
      credentialSource: "unknown",
      usage: {},
      estimatedCost: null,
      latencyMs,
      retries,
      success: false,
      errorCode: err.code || err.name,
      reqId,
      promptVersion,
      promptHash,
    });

    logError("ai_gateway_error", err, { reqId, jobId, task });
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateStructuredJson(params) {
  return runGatewayRequest(params, true);
}

async function generateText(params) {
  return runGatewayRequest(params, false);
}

function estimateCostPublic(args) {
  return estimateCost(args.provider, args.model, args.usage || {});
}

module.exports = {
  generateStructuredJson,
  generateText,
  healthCheck,
  estimateCost: estimateCostPublic,
  createExecutionContext,
};
