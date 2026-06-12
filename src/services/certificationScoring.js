const modelCertificationConfig = require("../config/modelCertification.config");

function roundScore(n) {
  return Math.round(Math.max(0, Math.min(100, n)));
}

function computeAttemptCertificationScore(resumeScore, emailScore) {
  return roundScore(resumeScore * 0.45 + emailScore * 0.55);
}

function averageSuccessfulRuns(runs, field) {
  const values = runs.filter((r) => r.success && typeof r[field] === "number").map((r) => r[field]);
  if (!values.length) return 0;
  return roundScore(values.reduce((a, b) => a + b, 0) / values.length);
}

function computeReliabilityScore(successfulRuns, attemptCount) {
  if (!attemptCount) return 0;
  return roundScore((successfulRuns / attemptCount) * 100);
}

function computeValueScore(certificationScore, totalCostUsd) {
  const cost = Math.max(totalCostUsd, 0.000001);
  return certificationScore / cost;
}

function normalizeValueScore(valueScore, divisor) {
  const d = divisor || modelCertificationConfig.valueNormDivisor;
  return roundScore(Math.min(100, (valueScore / d) * 100));
}

function computeOverallScore(certificationScore, normalizedValueScore, reliabilityScore) {
  return roundScore(
    certificationScore * 0.6 + normalizedValueScore * 0.2 + reliabilityScore * 0.2
  );
}

function deriveStatusFlags(overallScore) {
  const pass = modelCertificationConfig.passThreshold;
  const recommend = modelCertificationConfig.recommendThreshold;
  return {
    passed: overallScore >= pass,
    recommended: overallScore >= recommend,
  };
}

function aggregateCertificationResults(attemptRuns, attemptCount) {
  const successes = attemptRuns.filter((r) => r.success).length;
  const reliabilityScore = computeReliabilityScore(successes, attemptCount);

  const resumeScore = averageSuccessfulRuns(attemptRuns, "resumeScore");
  const emailScore = averageSuccessfulRuns(attemptRuns, "emailScore");
  const certificationScore = averageSuccessfulRuns(attemptRuns, "certificationScore");
  const judgeConfidence = averageSuccessfulRuns(attemptRuns, "confidence");

  const totalCostUsd = attemptRuns.reduce((sum, r) => sum + (r.costUsd || 0), 0);
  const totalLatencyMs = attemptRuns.reduce((sum, r) => sum + (r.latencyMs || 0), 0);
  const valueScore = computeValueScore(certificationScore, totalCostUsd);
  const normalizedValueScore = normalizeValueScore(valueScore);
  const overallScore = computeOverallScore(certificationScore, normalizedValueScore, reliabilityScore);
  const status = deriveStatusFlags(overallScore);

  const scoresJson = {
    runs: attemptRuns.map((r, i) => ({
      attempt: i + 1,
      success: r.success,
      resumeScore: r.success ? r.resumeScore : undefined,
      emailScore: r.success ? r.emailScore : undefined,
      certificationScore: r.success ? r.certificationScore : undefined,
      confidence: r.success ? r.confidence : undefined,
      costUsd: r.costUsd ?? 0,
      latencyMs: r.latencyMs ?? 0,
      error: r.error || undefined,
      groundingDetail: r.groundingDetail || undefined,
      subjectPreview: r.subjectPreview || undefined,
      bodyPreview: r.bodyPreview || undefined,
    })),
    resume: { score: resumeScore },
    email: { score: emailScore },
    judge: { confidence: judgeConfidence },
    reliability: { attempts: attemptCount, successes, score: reliabilityScore },
    certification: { score: certificationScore, resumeScore, emailScore },
    value: { score: valueScore, totalCostUsd },
    overall: { score: overallScore, normalizedValueScore },
  };

  return {
    resumeScore,
    emailScore,
    certificationScore,
    judgeConfidence,
    reliabilityScore,
    valueScore,
    normalizedValueScore,
    overallScore,
    totalCostUsd,
    totalLatencyMs,
    costPer100Runs: totalCostUsd * 100,
    costPer1000Runs: totalCostUsd * 1000,
    scoresJson,
    ...status,
  };
}

module.exports = {
  roundScore,
  computeAttemptCertificationScore,
  averageSuccessfulRuns,
  computeReliabilityScore,
  computeValueScore,
  normalizeValueScore,
  computeOverallScore,
  deriveStatusFlags,
  aggregateCertificationResults,
};
