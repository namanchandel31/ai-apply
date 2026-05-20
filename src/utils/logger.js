/**
 * Structured JSON Logger backed by Pino.
 */

const pino = require("pino");
const { isDebugEnabled } = require("./debugFlags");

const OPENAI_RATES = {
  "gpt-4.1-mini": { input: 0.40 / 1_000_000, output: 1.60 / 1_000_000 },
};

const computeEstimatedCost = (model, tokensIn, tokensOut) => {
  const rates = OPENAI_RATES[model];
  if (!rates || typeof tokensIn !== "number" || typeof tokensOut !== "number") return undefined;
  return parseFloat(((tokensIn * rates.input) + (tokensOut * tokens.output)).toFixed(6));
};

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
});

const SCRUB_KEYS = new Set(["rawText", "cleanedText", "text", "buffer"]);

const scrubMetadata = (metadata) => {
  const safe = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!SCRUB_KEYS.has(k)) safe[k] = v;
  }
  return safe;
};

const buildLogPayload = (event, metadata = {}) => {
  const safe = scrubMetadata(metadata);
  if (safe.model && safe.tokens_in != null && safe.tokens_out != null) {
    safe.estimated_cost = computeEstimatedCost(safe.model, safe.tokens_in, safe.tokens_out);
  }
  return {
    event,
    requestId: safe.reqId || safe.requestId || "UNKNOWN",
    userId: safe.userId || undefined,
    applicationId: safe.applicationId || undefined,
    retryCount: safe.retryCount ?? safe.attempt ?? undefined,
    state: safe.state || safe.application_status || safe.email_status || undefined,
    provider: safe.provider || undefined,
    duration: safe.duration || undefined,
    model: safe.model || undefined,
    tokens_in: safe.tokens_in || undefined,
    tokens_out: safe.tokens_out || undefined,
    latency: safe.latency || undefined,
    estimated_cost: safe.estimated_cost || undefined,
    ...safe,
  };
};

const logInfo = (event, metadata = {}) => {
  logger.info(buildLogPayload(event, metadata));
};

const logWarn = (event, metadata = {}) => {
  logger.warn(buildLogPayload(event, metadata));
};

/**
 * @param {string} event
 * @param {object} [metadata]
 * @param {import('./debugFlags').OrchestrationComponent} [component]
 */
const logDebug = (event, metadata = {}, component) => {
  const comp = component || metadata.component;
  if (comp && !isDebugEnabled(comp)) return;
  if (!comp && process.env.LOG_LEVEL !== "debug") return;
  logger.debug(buildLogPayload(event, metadata));
};

const logError = (event, error, metadata = {}) => {
  const safe = scrubMetadata(metadata);
  logger.error({
    ...buildLogPayload(event, safe),
    error_type: error?.name || "UnknownError",
    error_message: error?.message || "No error message provided",
    error_stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
  });
};

module.exports = { logInfo, logWarn, logError, logDebug, logger, isDebugEnabled };
