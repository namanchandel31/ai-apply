const { generateStructuredJson } = require("./aiGateway");
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { isValidEmail, isValidPhone, isNonEmptyString } = require("../utils/validators");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { JDSchema } = require("../schemas/jdSchema");
const { SYSTEM_PROMPT, PROMPT_VERSION } = require("../prompts/jdParsePrompt");
const { logInfo, logError } = require("../utils/logger");
const { isDebugAiEnabled } = require("../config/logging.config");
const { metrics } = require("../observability/orchestrationMetrics");

const MAX_INPUT_LENGTH = 15000;
const DEBUG_AI_SNAPSHOT_MAX = 2000;

function metadataForParsed(data) {
  return {
    hasTitle: Boolean(data?.job_title),
    skillsCount: Array.isArray(data?.skills) ? data.skills.length : 0,
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
  logInfo("JD_PARSE_AI_SNAPSHOT_DEBUG", {
    ...meta,
    snapshot,
  });
}

const parseJobDescription = async (rawText, userId, meta = {}) => {
  if (!userId) {
    throw new NonRetryableError("parseJobDescription: userId is required");
  }
  if (!isNonEmptyString(rawText)) {
    throw new NonRetryableError("parseJobDescription: rawText must be a non-empty string");
  }

  const text = rawText.trim().slice(0, MAX_INPUT_LENGTH);
  const logMeta = { reqId: meta.reqId, userId };

  try {
    const parsed = await withRetry(async () => {
      const aiResult = await generateStructuredJson({
        userId,
        task: "jd_parse",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: text,
        promptVersion: PROMPT_VERSION,
        reqId: meta.reqId,
        endpoint: "jd_parse",
      });

      const validation = JDSchema.safeParse(aiResult);
      if (!validation.success) {
        throw new NonRetryableError(
          `Schema validation failed: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
        );
      }
      return validation.data;
    }, { maxAttempts: 3 });

    const data = parsed;
    if (data.contact_email && !isValidEmail(data.contact_email)) {
      data.contact_email = null;
    }
    if (data.contact_number && !isValidPhone(data.contact_number)) {
      data.contact_number = null;
    }
    data.skills = normalizeSkills(data.skills || []);
    data.job_title = nullifyEmpty(data.job_title);
    data.company_name = nullifyEmpty(data.company_name);

    const metaFields = metadataForParsed(data);
    logInfo("JD_PARSE_RESPONSE_RECEIVED", { ...logMeta, ...metaFields });
    maybeDebugAiSnapshot(data, logMeta);

    if (!data.skills?.length || !data.job_title) {
      logInfo("JD_PARSE_INVALID_CONTENT", { ...logMeta, ...metaFields });
      maybeDebugAiSnapshot(data, logMeta);
      metrics.increment("orchestration.jd_parse.failure", { retryable: "false" });
      throw new NonRetryableError("invalid_parsed_content");
    }

    return data;
  } catch (err) {
    const retryable = err instanceof RetryableError;
    logError("JD_PARSE_FAILED", err, {
      ...logMeta,
      error_message: err?.message,
      retryable,
    });
    metrics.increment("orchestration.jd_parse.failure", {
      retryable: retryable ? "true" : "false",
    });
    throw err;
  }
};

module.exports = { parseJobDescription, PROMPT_VERSION };
