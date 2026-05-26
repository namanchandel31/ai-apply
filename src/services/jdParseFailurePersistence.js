const crypto = require("crypto");
const { saveFailedParse } = require("../models/failedParseModel");
const { logInfo, logError } = require("../utils/logger");

function jdParseFailureHash(jobDescriptionId, rawText) {
  if (jobDescriptionId) return `jd:${jobDescriptionId}`;
  return crypto.createHash("sha256").update(String(rawText || "")).digest("hex");
}

/**
 * Persist invalid JD parse output for offline debugging / regression.
 */
async function persistJdParseFailure({
  jobDescriptionId,
  rawText,
  errorMessage,
  rawLlmResponse,
  llmData,
  enrichedData,
  validation,
  provider,
  promptVersion,
  parseOutcome,
}) {
  const fileHash = jdParseFailureHash(jobDescriptionId, rawText);
  const payload = {
    code: errorMessage,
    parseOutcome,
    promptVersion,
    provider: provider || null,
    validation: validation || null,
    llmData: llmData || null,
    enrichedData: enrichedData
      ? {
          job_title: enrichedData.job_title,
          roles: enrichedData.roles,
          skills: enrichedData.skills,
          parseOutcome: enrichedData.parseOutcome,
          parseConfidence: enrichedData.parseConfidence,
        }
      : null,
    rawLlmResponse:
      rawLlmResponse != null
        ? typeof rawLlmResponse === "object"
          ? rawLlmResponse
          : { raw: String(rawLlmResponse).slice(0, 8000) }
        : null,
  };

  let safeMessage;
  try {
    safeMessage = JSON.stringify(payload).slice(0, 12000);
  } catch {
    safeMessage = String(errorMessage || "invalid_parsed_content").slice(0, 2000);
  }

  try {
    await saveFailedParse(fileHash, "jd", rawText, safeMessage);
    logInfo("JD_PARSE_FAILURE_PERSISTED", {
      fileHash,
      jobDescriptionId: jobDescriptionId || null,
      parseOutcome,
      promptVersion,
      provider: provider?.provider || provider?.name,
      model: provider?.model,
    });
    return fileHash;
  } catch (err) {
    logError("JD_PARSE_FAILURE_PERSIST_FAILED", err, { fileHash });
    return null;
  }
}

module.exports = {
  persistJdParseFailure,
  jdParseFailureHash,
};
