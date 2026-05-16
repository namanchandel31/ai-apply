const OpenAI = require("openai");
const { z } = require("zod");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "gpt-4.1-mini";
const LLM_TIMEOUT_MS = 10_000;   // 10 seconds
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAYS_MS = [250, 750, 2000]; // indexed by attempt - 1 (0-based)

// Truncation limit for raw LLM output stored as TEXT in the DB.
const RAW_OUTPUT_MAX_CHARS = 5_000;

// ---------------------------------------------------------------------------
// Zod schema — strict output contract
// ---------------------------------------------------------------------------

const emailResponseSchema = z.object({
  subject: z.string().min(5).max(120),
  body: z.string().min(1).max(1500),
});

// ---------------------------------------------------------------------------
// OpenAI client factory (keeps API key out of module scope for testability)
// ---------------------------------------------------------------------------

const getOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Classify an error to determine if it is worth retrying.
 * Returns true only for transient conditions:
 *   - AbortError (our 10s timeout)
 *   - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
 *   - HTTP 429 (rate limited)
 *   - HTTP 5xx (server-side failure)
 *   - Empty/missing response body
 *   - JSON parse failure (RetryableError thrown by caller)
 * Does NOT retry: HTTP 400/401/403, Zod validation failure (NonRetryableError).
 */
const isRetryable = (err) => {
  if (err instanceof NonRetryableError) return false;
  if (err instanceof RetryableError) return true;
  if (err.name === "AbortError") return true;
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(err.code)) return true;
  if (err.status >= 500 || err.status === 429) return true;
  return false;
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert career coach writing a job application email.

Rules (follow strictly):
1. Write in a professional, direct tone.
2. No generic fluff like "I am excited to apply" or "I came across your job posting".
3. No storytelling. Get straight to the point.
4. Keep the body strictly between 8 to 12 lines.
5. Make it sound human, not robotic.
6. Output ONLY valid JSON matching the exact schema — no markdown, no explanation.

Schema:
{
  "subject": "string (5-120 chars)",
  "body": "string (1-1500 chars)"
}`;

// ---------------------------------------------------------------------------
// Core LLM call (single attempt, throws on any failure)
// ---------------------------------------------------------------------------

const callLLM = async (userPrompt, logMeta) => {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  const start = Date.now();
  let response;

  try {
    response = await openai.responses.create(
      {
        model: MODEL,
        temperature: 0,
        text: { format: { type: "json_object" } },
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userPrompt },
        ],
      },
      { signal: controller.signal }
    );
  } catch (err) {
    if (err.name === "AbortError") {
      throw new RetryableError(`LLM request timed out after ${LLM_TIMEOUT_MS}ms`);
    }
    throw err; // re-throw; isRetryable() will classify at the retry loop level
  } finally {
    clearTimeout(timeoutHandle);
  }

  const latency = Date.now() - start;
  const rawContent = response.output_text?.trim() ?? "";

  // Capture usage for cost observability
  const tokensIn  = response.usage?.input_tokens  ?? 0;
  const tokensOut = response.usage?.output_tokens ?? 0;

  logInfo("llm_response", {
    ...logMeta,
    provider: "openai",
    model:      MODEL,
    tokens_in:  tokensIn,
    tokens_out: tokensOut,
    latency,
  });

  if (!rawContent) {
    throw new RetryableError("Empty response from OpenAI");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new RetryableError("Invalid JSON from OpenAI");
  }

  const validation = emailResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new NonRetryableError(
      `Schema validation failed: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
    );
  }

  // Return validated data + the raw string (truncated) for DB storage
  return {
    email: validation.data,
    llmRawOutput: rawContent.slice(0, RAW_OUTPUT_MAX_CHARS),
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a tailored job application email using OpenAI.
 *
 * Implements a 3-attempt retry loop with exponential backoff (250→750→2000ms).
 * Retries only on transient errors (timeout, network, 429, 5xx, bad JSON).
 * Throws NonRetryableError immediately on schema/validation failures.
 *
 * @param {string}   candidateName
 * @param {string}   jobTitle
 * @param {string[]} matchedSkills
 * @param {number}   matchScore
 * @param {object}   logMeta        - Structured logging context (requestId, userId, etc.)
 * @returns {Promise<{ email: { subject: string, body: string }, llmRawOutput: string }>}
 */
const generateApplicationEmail = async (candidateName, jobTitle, matchedSkills, matchScore, logMeta = {}) => {
  let skillFocus;
  if (matchScore === 0 || !matchedSkills?.length) {
    skillFocus =
      "Do NOT list specific skills. Focus entirely on adaptability, eagerness to learn, and general professional experience.";
  } else {
    skillFocus = `Explicitly mention how these specific skills make the candidate a fit: ${matchedSkills.join(", ")}. Do NOT mention any missing skills.`;
  }

  const userPrompt =
    `Candidate Name: ${candidateName || "A professional candidate"}\n` +
    `Job Title: ${jobTitle || "the open role"}\n\n` +
    `Skill focus: ${skillFocus}`;

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      logInfo("llm_attempt", { ...logMeta, provider: "openai", model: MODEL, retryCount: attempt - 1 });

      const result = await callLLM(userPrompt, { ...logMeta, attempt });
      logInfo("llm_success", { ...logMeta, provider: "openai", model: MODEL, retryCount: attempt - 1 });
      return result;

    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        logError("llm_non_retryable", err, { ...logMeta, provider: "openai", retryCount: attempt - 1 });
        throw err;
      }

      logError("llm_retry", err, { ...logMeta, provider: "openai", retryCount: attempt - 1, nextAttempt: attempt + 1 });

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_DELAYS_MS[attempt - 1]);
      }
    }
  }

  throw new RetryableError(
    `LLM email generation failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`
  );
};

module.exports = { generateApplicationEmail };
