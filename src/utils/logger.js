/**
 * Structured JSON Logger for observability.
 * Ensures consistent log structure across the application.
 */

const scrubMetadata = (metadata) => {
  const safeMeta = { ...metadata };
  delete safeMeta.rawText;
  delete safeMeta.cleanedText;
  delete safeMeta.text;
  return safeMeta;
};

const logInfo = (event, metadata = {}) => {
  const safeMeta = scrubMetadata(metadata);
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "INFO",
    event,
    requestId: safeMeta.reqId || "UNKNOWN",
    jobId: safeMeta.jobId || "UNKNOWN",
    fileHash: safeMeta.fileHash || "UNKNOWN",
    status: safeMeta.status || "success",
    stage: safeMeta.stage || "unknown",
    attempt: safeMeta.attempt || 1,
    ...safeMeta
  }));
};

const logError = (event, error, metadata = {}) => {
  const safeMeta = scrubMetadata(metadata);
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "ERROR",
    event,
    requestId: safeMeta.reqId || "UNKNOWN",
    jobId: safeMeta.jobId || "UNKNOWN",
    fileHash: safeMeta.fileHash || "UNKNOWN",
    status: safeMeta.status || "failed",
    stage: safeMeta.stage || "unknown",
    attempt: safeMeta.attempt || 1,
    error_type: error.name || safeMeta.error_type || "UnknownError",
    error_message: error.message || safeMeta.error_message || "No error message provided",
    ...safeMeta
  }));
};

module.exports = { logInfo, logError };
