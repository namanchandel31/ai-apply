const { str, bool, parseDebugScopes } = require("./env");
const { isDevelopment } = require("./server.config");

const LOG_DEDUPE_WINDOW_MS = 60_000;
const LOG_DEDUPE_BUCKET_TTL_MS = 120_000;
const LOG_DEDUPE_MAX_BUCKETS = 500;

const debugScopes = parseDebugScopes();

function hasDebugScope(scope) {
  if (debugScopes.has(scope)) return true;
  if (scope !== "orchestration" && debugScopes.has("orchestration")) return true;
  return false;
}

function isOrchestrationDebugEnabled(_component) {
  return hasDebugScope("orchestration");
}

module.exports = {
  logLevel: str("LOG_LEVEL", "info"),
  logPretty: bool("LOG_PRETTY", isDevelopment),
  debugScopes,
  hasDebugScope,
  isOrchestrationDebugEnabled,
  LOG_DEDUPE_WINDOW_MS,
  LOG_DEDUPE_BUCKET_TTL_MS,
  LOG_DEDUPE_MAX_BUCKETS,
};
