const OpenAI = require("openai");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { extractOpenAIResponse } = require("../utils/openaiHelper");
const {
  LLM_MODEL,
  LLM_TIMEOUT_MS,
} = require("../config/parsingConfig");

const getOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Call OpenAI Responses API with timeout, structured logging, and JSON output.
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {string} params.reqId
 * @param {string} params.jobId
 * @param {string} params.source - resume | jd
 * @param {number} params.attempt
 */
const callOpenAIJson = async ({
  systemPrompt,
  userPrompt,
  reqId = "UNKNOWN",
  jobId = "UNKNOWN",
  source = "unknown",
  attempt = 1,
}) => {
  const openai = getOpenAIClient();
  const inputChars = userPrompt.length;
  const startedAt = Date.now();

  logInfo("llm_request_start", {
    reqId,
    jobId,
    source,
    attempt,
    model: LLM_MODEL,
    inputChars,
    timeoutMs: LLM_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await openai.responses.create(
      {
        model: LLM_MODEL,
        temperature: 0,
        text: { format: { type: "json_object" } },
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: controller.signal }
    );

    const elapsedMs = Date.now() - startedAt;
    logInfo("llm_request_end", {
      reqId,
      jobId,
      source,
      attempt,
      model: LLM_MODEL,
      inputChars,
      elapsedMs,
      status: "success",
    });

    return extractOpenAIResponse(response);
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const aborted = err.name === "AbortError" || err.message?.includes("aborted");

    logError("llm_request_end", err, {
      reqId,
      jobId,
      source,
      attempt,
      model: LLM_MODEL,
      inputChars,
      elapsedMs,
      timeoutMs: LLM_TIMEOUT_MS,
      status: aborted ? "timeout" : "error",
    });

    if (aborted) {
      throw new RetryableError(`LLM response timed out after ${elapsedMs}ms`);
    }

    if (err.status && [429, 500, 502, 503, 504].includes(err.status)) {
      throw new RetryableError(`OpenAI request failed: ${err.message}`);
    }

    throw new NonRetryableError(`OpenAI permanent failure: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = {
  callOpenAIJson,
  LLM_MODEL,
};
