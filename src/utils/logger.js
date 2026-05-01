/**
 * Structured JSON Logger for observability.
 * Ensures consistent log structure across the application.
 */

const logInfo = (event, metadata = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    event,
    stage: metadata.stage || "unknown",
    attempt: metadata.attempt || 1,
    ...metadata
  }));
};

const logError = (event, error, metadata = {}) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "ERROR",
    event,
    stage: metadata.stage || "unknown",
    attempt: metadata.attempt || 1,
    error_type: error.name || metadata.error_type || "UnknownError",
    error_message: error.message || metadata.error_message || "No error message provided",
    ...metadata
  }));
};

module.exports = { logInfo, logError };
