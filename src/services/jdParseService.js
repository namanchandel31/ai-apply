const { generateStructuredJson } = require("./aiGateway");
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { isNonEmptyString } = require("../utils/validators");
const { JdLlmOutputSchema } = require("../domain/jd/jdParseContract");
const { normalizeProviderPayload } = require("./jdProviderNormalizer");
const { enrichParsedJd } = require("./jdParseEnrichment");
const { buildContentValidationDiagnostics } = require("./jdParseValidation");
const { persistJdParseFailure } = require("./jdParseFailurePersistence");
const { SYSTEM_PROMPT, PROMPT_VERSION } = require("../prompts/jdParsePrompt");
const { logInfo, logError } = require("../utils/logger");
const { isDebugAiEnabled } = require("../config/logging.config");
const { metrics } = require("../observability/orchestrationMetrics");
const jdParseConfig = require("../config/jdParse.config");

const DEBUG_AI_SNAPSHOT_MAX = 2000;

function metadataForParsed(data) {
  return {
    hasTitle: Boolean(data?.job_title),
    skillsCount: Array.isArray(data?.skills) ? data.skills.length : 0,
    parseOutcome: data?.parseOutcome,
    parseConfidence: data?.parseConfidence,
    outputKeys: data && typeof data === "object" ? Object.keys(data) : [],
  };
}

function maybeDebugAiSnapshot(aiResult, meta) {
  if (!isDebugAiEnabled() || aiResult == null) return;
  let snapshot;
  try {
    snapshot = JSON.stringify(aiResult).slice(0, DEBUG_AI_SNAPSHOT_MAX);
  } catch {
    snapshot = "[unserializable]";
  }
  logInfo("JD_PARSE_AI_SNAPSHOT_DEBUG", { ...meta, snapshot });
}

function recordParseMetrics(enriched, logMeta, { failure = false, retryable = false, validation = null } = {}) {
  if (failure) {
    metrics.increment("orchestration.jd_parse.failure", {
      retryable: retryable ? "true" : "false",
      outcome: enriched?.parseOutcome || validation?.primaryFailure || "error",
    });
    if (validation?.missingFields?.includes("job_title")) {
      metrics.increment("orchestration.jd_parse.validation_failure", {
        field: "job_title",
      });
    }
    return;
  }

  metrics.increment("orchestration.jd_parse.success", {
    outcome: enriched.parseOutcome || "unknown",
  });
  metrics.increment("orchestration.jd_parse.outcome", {
    outcome: enriched.parseOutcome || "unknown",
  });
  metrics.histogram("orchestration.jd_parse.confidence", enriched.parseConfidence ?? 0);

  const titleSource = enriched.parseArtifacts?.selection?.titleSource;
  if (titleSource && titleSource !== "explicit_llm") {
    metrics.increment("orchestration.jd_parse.fallback", { titleSource });
  }
  if (enriched.parseArtifacts?.heuristicExtraction?.roleCandidates?.length) {
    metrics.increment("orchestration.jd_parse.heuristic_used", { used: "true" });
  }

  const providerName = enriched.parseArtifacts?.provider?.provider || enriched.parseArtifacts?.provider?.name;
  if (providerName) {
    metrics.increment("orchestration.jd_parse.provider", { provider: String(providerName) });
  }
}

/**
 * @param {string} rawText
 * @param {string} userId
 * @param {{ reqId?: string, resumeSkills?: string[], jobDescriptionId?: string }} meta
 */
const parseJobDescription = async (rawText, userId, meta = {}) => {
  if (!userId) {
    throw new NonRetryableError("parseJobDescription: userId is required");
  }
  if (!isNonEmptyString(rawText)) {
    throw new NonRetryableError("parseJobDescription: rawText must be a non-empty string");
  }

  const text = rawText.trim().slice(0, jdParseConfig.MAX_INPUT_LENGTH);
  const logMeta = { reqId: meta.reqId, userId, jobDescriptionId: meta.jobDescriptionId };
  const llmStart = Date.now();

  let rawLlmResponse = null;
  let providerMeta = {};
  let llmData = null;

  try {
    llmData = await withRetry(async () => {
      const gatewayResult = await generateStructuredJson({
        userId,
        task: "jd_parse",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: text,
        promptVersion: PROMPT_VERSION,
        reqId: meta.reqId,
        endpoint: "jd_parse",
      });

      providerMeta = {
        provider: gatewayResult?._provider || gatewayResult?.provider,
        model: gatewayResult?._model || gatewayResult?.model,
      };

      const normalized = normalizeProviderPayload(gatewayResult, providerMeta);
      rawLlmResponse = normalized.rawLlmResponse;

      const validation = JdLlmOutputSchema.safeParse(normalized.data);
      if (!validation.success) {
        metrics.increment("orchestration.jd_parse.schema_failure", {
          provider: String(providerMeta.provider || "unknown"),
        });
        throw new RetryableError(
          `schema_mismatch: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
        );
      }
      return validation.data;
    }, { maxAttempts: 3 });

    const llmMs = Date.now() - llmStart;

    logInfo("JD_PARSE_RESPONSE_RECEIVED", {
      ...logMeta,
      hasTitle: Boolean(llmData?.job_title),
      skillsCount: Array.isArray(llmData?.skills) ? llmData.skills.length : 0,
      provider: providerMeta.provider,
      model: providerMeta.model,
      promptVersion: PROMPT_VERSION,
    });

    const enriched = enrichParsedJd({
      rawText: text,
      llmData,
      resumeSkills: meta.resumeSkills || [],
      promptVersion: PROMPT_VERSION,
      provider: providerMeta,
      rawLlmResponse,
      timings: { llmMs },
    });

    const data = enriched.data;
    const validation = buildContentValidationDiagnostics({
      llmData,
      enrichedData: data,
    });

    const metaFields = metadataForParsed(data);

    logInfo("JD_PARSE_ENRICHED", {
      ...logMeta,
      ...metaFields,
      validation,
      roleCandidates: data.parseArtifacts?.selection?.roleCandidates,
      selectedRole: data.job_title,
      selectionReason: data.parseArtifacts?.selection?.selectionReason,
      titleSource: data.parseArtifacts?.selection?.titleSource,
    });
    maybeDebugAiSnapshot(data, logMeta);
    recordParseMetrics(data, logMeta);

    if (!enriched.isApplyEligible) {
      logInfo("JD_PARSE_INVALID_CONTENT", {
        ...logMeta,
        ...metaFields,
        parseOutcome: enriched.parseOutcome,
        validation,
        retryable: false,
      });
      metrics.increment("orchestration.jd_parse.failure", {
        retryable: "false",
        outcome: enriched.parseOutcome,
      });

      await persistJdParseFailure({
        jobDescriptionId: meta.jobDescriptionId,
        rawText: text,
        errorMessage: "invalid_parsed_content",
        rawLlmResponse,
        llmData,
        enrichedData: data,
        validation,
        provider: providerMeta,
        promptVersion: PROMPT_VERSION,
        parseOutcome: enriched.parseOutcome,
      });

      const err = new NonRetryableError("invalid_parsed_content");
      err.code = "invalid_parsed_content";
      err.parseOutcome = enriched.parseOutcome;
      err.validation = validation;
      err.parseDiagnostics = data.parseArtifacts;
      err.retryable = false;
      throw err;
    }

    if (validation.missingFields.includes("job_title") && data.job_title) {
      metrics.increment("orchestration.jd_parse.fallback", {
        titleSource: data.parseArtifacts?.selection?.titleSource || "fallback",
      });
    }

    metrics.histogram("orchestration.jd_parse.duration_ms", llmMs, { phase: "llm" });
    metrics.histogram(
      "orchestration.jd_parse.duration_ms",
      data.parseArtifacts?.timings?.enrichMs || 0,
      { phase: "enrich" }
    );

    return data;
  } catch (err) {
    const retryable = err instanceof RetryableError;
    logError("JD_PARSE_FAILED", err, {
      ...logMeta,
      error_message: err?.message,
      retryable,
      error_type: err?.name,
      failure_class: retryable ? "retryable_transient" : "unrecoverable_parse",
      validation: err.validation || null,
    });
    recordParseMetrics(
      { parseOutcome: err.parseOutcome },
      logMeta,
      { failure: true, retryable, validation: err.validation }
    );

    if (!retryable && llmData) {
      await persistJdParseFailure({
        jobDescriptionId: meta.jobDescriptionId,
        rawText: text,
        errorMessage: err.message,
        rawLlmResponse,
        llmData,
        provider: providerMeta,
        promptVersion: PROMPT_VERSION,
        validation: err.validation,
      }).catch(() => {});
    }

    if (!retryable) {
      err.retryable = false;
    }
    throw err;
  }
};

module.exports = { parseJobDescription, PROMPT_VERSION };
