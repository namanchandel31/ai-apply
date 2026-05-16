/**
 * Structured JSON Logger backed by Pino.
 *
 * Preserves the existing logInfo / logError call signatures so no
 * callsite changes are needed across the codebase.
 *
 * Base fields emitted on every log line:
 *   requestId, userId, applicationId, retryCount, state, provider, duration, msg
 *
 * Extended fields emitted on OpenAI operation logs (pass via metadata):
 *   model, tokens_in, tokens_out, latency, estimated_cost
 *
 * Cost computation (gpt-4.1-mini rates as of 2025-05):
 *   Input:  $0.40 per 1M tokens
 *   Output: $1.60 per 1M tokens
 */

const pino = require("pino");

// ---------------------------------------------------------------------------
// gpt-4.1-mini token pricing (USD per token). Update when rates change.
// ---------------------------------------------------------------------------
const OPENAI_RATES = {
  "gpt-4.1-mini": { input: 0.40 / 1_000_000, output: 1.60 / 1_000_000 },
};

const computeEstimatedCost = (model, tokensIn, tokensOut) => {
  const rates = OPENAI_RATES[model];
  if (!rates || typeof tokensIn !== "number" || typeof tokensOut !== "number") return undefined;
  return parseFloat(((tokensIn * rates.input) + (tokensOut * rates.output)).toFixed(6));
};

// ---------------------------------------------------------------------------
// Pino instance — JSON lines to stdout, pretty-print only in development.
// ---------------------------------------------------------------------------
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: null,           // omit pino's default pid/hostname fields
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
});

// ---------------------------------------------------------------------------
// Field scrubbing — never log raw resume/JD text bodies.
// ---------------------------------------------------------------------------
const SCRUB_KEYS = new Set(["rawText", "cleanedText", "text", "buffer"]);

const scrubMetadata = (metadata) => {
  const safe = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!SCRUB_KEYS.has(k)) safe[k] = v;
  }
  return safe;
};

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for the old console-based logInfo/logError.
// ---------------------------------------------------------------------------

/**
 * Log an informational event.
 *
 * @param {string} event        - Machine-readable event name (e.g. "llm_success").
 * @param {object} [metadata]   - Arbitrary context. Scrubbed before logging.
 *                                Special keys: model, tokens_in, tokens_out, latency →
 *                                triggers OpenAI cost computation.
 */
const logInfo = (event, metadata = {}) => {
  const safe = scrubMetadata(metadata);

  // Auto-compute estimated_cost when OpenAI usage fields are present.
  if (safe.model && safe.tokens_in != null && safe.tokens_out != null) {
    safe.estimated_cost = computeEstimatedCost(safe.model, safe.tokens_in, safe.tokens_out);
  }

  logger.info({
    event,
    requestId:     safe.reqId        || safe.requestId     || "UNKNOWN",
    userId:        safe.userId                              || undefined,
    applicationId: safe.applicationId                      || undefined,
    retryCount:    safe.retryCount    ?? safe.attempt       ?? undefined,
    state:         safe.state         || safe.email_status  || undefined,
    provider:      safe.provider                            || undefined,
    duration:      safe.duration                            || undefined,
    // OpenAI observability fields
    model:         safe.model                               || undefined,
    tokens_in:     safe.tokens_in                          || undefined,
    tokens_out:    safe.tokens_out                         || undefined,
    latency:       safe.latency                            || undefined,
    estimated_cost:safe.estimated_cost                     || undefined,
    // Pass all remaining safe fields through
    ...safe,
  });
};

/**
 * Log an error event with structured error details.
 *
 * @param {string} event       - Machine-readable event name.
 * @param {Error}  error       - The caught error object.
 * @param {object} [metadata]  - Arbitrary context.
 */
const logError = (event, error, metadata = {}) => {
  const safe = scrubMetadata(metadata);

  logger.error({
    event,
    requestId:     safe.reqId        || safe.requestId     || "UNKNOWN",
    userId:        safe.userId                              || undefined,
    applicationId: safe.applicationId                      || undefined,
    retryCount:    safe.retryCount    ?? safe.attempt       ?? undefined,
    state:         safe.state         || safe.email_status  || undefined,
    provider:      safe.provider                            || undefined,
    duration:      safe.duration                            || undefined,
    error_type:    error?.name        || "UnknownError",
    error_message: error?.message     || "No error message provided",
    error_stack:   process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    ...safe,
  });
};

// Export the raw pino instance for pino-http in index.js.
module.exports = { logInfo, logError, logger };
