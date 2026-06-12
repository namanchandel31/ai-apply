const modelCertificationConfig = require("../config/modelCertification.config");
const { resolveCertificationResumeText } = require("./certificationResumeInput");
const { executeCertificationAttempt, formatAttemptError } = require("./executeCertificationAttempt");
const { aggregateCertificationResults } = require("./certificationScoring");
const modelCertificationRunModel = require("../models/modelCertificationRunModel");
const { logCertificationDebug } = require("./certificationDebug");
const { NonRetryableError } = require("../utils/errors");

function mergeProviderMetadata(attemptRuns) {
  const merged = {};
  for (const run of attemptRuns) {
    const meta = run.providerMetadata || {};
    for (const [key, value] of Object.entries(meta)) {
      if (!value) continue;
      if (!merged[key]) merged[key] = [];
      merged[key].push(value);
    }
  }
  const out = {};
  for (const [key, arr] of Object.entries(merged)) {
    out[key] = arr.length === 1 ? arr[0] : arr;
  }
  return out;
}

async function runModelCertification({
  userId,
  provider,
  model,
  apiKey,
  resumeSource,
  uploadBuffer,
  reqId,
}) {
  let cleanedText;
  try {
    cleanedText = await resolveCertificationResumeText({
      userId,
      resumeSource,
      uploadBuffer,
    });
    logCertificationDebug("resume_resolution_complete", {
      resumeSource,
      resolvedResumeLength: cleanedText.length,
    });
  } catch (err) {
    logCertificationDebug("resume_resolution_failed", {
      resumeSource,
      message: err?.message,
    });
    throw new NonRetryableError(
      JSON.stringify({
        step: "resume_source",
        message: err?.message || "Failed to resolve resume text",
        attempt: 0,
      })
    );
  }

  const attemptCount = modelCertificationConfig.CERTIFICATION_ATTEMPT_COUNT;
  const attemptRuns = [];

  for (let i = 1; i <= attemptCount; i += 1) {
    const result = await executeCertificationAttempt({
      userId,
      cleanedText,
      provider,
      model,
      apiKey,
      reqId,
      attempt: i,
    });
    attemptRuns.push(result);
  }

  const aggregated = aggregateCertificationResults(attemptRuns, attemptCount);
  const providerResponseMetadata = mergeProviderMetadata(attemptRuns);

  const errorMessage =
    aggregated.reliabilityScore === 0
      ? attemptRuns.map((r) => formatAttemptError(r.error)).filter(Boolean).join(" | ") ||
        "All attempts failed"
      : null;

  logCertificationDebug("aggregation_complete", {
    overallScore: aggregated.overallScore,
    reliabilityScore: aggregated.reliabilityScore,
    successes: attemptRuns.filter((r) => r.success).length,
  });

  const saved = await modelCertificationRunModel.createRun({
    userId,
    provider,
    model,
    resumeSource,
    certificationScore: aggregated.certificationScore,
    reliabilityScore: aggregated.reliabilityScore,
    valueScore: aggregated.valueScore,
    overallScore: aggregated.overallScore,
    passed: aggregated.passed,
    recommended: aggregated.recommended,
    scoresJson: aggregated.scoresJson,
    providerResponseMetadata,
    errorMessage,
  });

  return {
    runId: saved.id,
    provider,
    model,
    resumeScore: aggregated.resumeScore,
    emailScore: aggregated.emailScore,
    certificationScore: aggregated.certificationScore,
    reliabilityScore: aggregated.reliabilityScore,
    judgeConfidence: aggregated.judgeConfidence,
    valueScore: aggregated.valueScore,
    overallScore: aggregated.overallScore,
    passed: aggregated.passed,
    recommended: aggregated.recommended,
    totalCostUsd: aggregated.totalCostUsd,
    costPer100Runs: aggregated.costPer100Runs,
    costPer1000Runs: aggregated.costPer1000Runs,
    totalLatencyMs: aggregated.totalLatencyMs,
    scores: aggregated.scoresJson,
  };
}

module.exports = { runModelCertification };
