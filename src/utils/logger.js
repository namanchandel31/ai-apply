/**
 * Structured JSON Logger backed by Pino.
 */

const pino = require("pino");
const config = require("../config");
const logging = config.logging;

const OPENAI_RATES = {
  "gpt-4.1-mini": { input: 0.40 / 1_000_000, output: 1.60 / 1_000_000 },
};

const computeEstimatedCost = (model, tokensIn, tokensOut) => {
  const rates = OPENAI_RATES[model];
  if (!rates || typeof tokensIn !== "number" || typeof tokensOut !== "number") return undefined;
  return parseFloat(((tokensIn * rates.input) + (tokensOut * rates.output)).toFixed(6));
};

const logger = pino({
  level: logging.logLevel,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: logging.logPretty
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
  let traceFromStore = {};
  try {
    const { getTraceFields } = require("../observability/orchestrationTraceContext");
    traceFromStore = getTraceFields();
  } catch {
    /* optional during early boot */
  }
  return {
    event,
    traceId: safe.traceId || traceFromStore.traceId,
    requestId: safe.reqId || safe.requestId || traceFromStore.requestId,
    orchestrationId: safe.orchestrationId || traceFromStore.orchestrationId,
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
 * @param {string} [component] orchestration sub-component (maps to orchestration debug scope)
 */
const logDebug = (event, metadata = {}, component) => {
  const comp = component || metadata.component;
  if (comp && !logging.isOrchestrationDebugEnabled(comp)) return;
  if (!comp && logging.logLevel !== "debug") return;
  logger.debug(buildLogPayload(event, metadata));
};

const logError = (event, error, metadata = {}) => {
  const safe = scrubMetadata(metadata);
  logger.error({
    ...buildLogPayload(event, safe),
    error_type: error?.name || "UnknownError",
    error_message: error?.message || "No error message provided",
    error_stack: config.server.isProduction ? undefined : error?.stack,
  });
};

module.exports = { logInfo, logWarn, logError, logDebug, logger };
