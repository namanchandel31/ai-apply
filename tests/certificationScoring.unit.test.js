const {
  aggregateCertificationResults,
  computeReliabilityScore,
  computeOverallScore,
  normalizeValueScore,
} = require("../src/services/certificationScoring");
const { formatAttemptError } = require("../src/services/executeCertificationAttempt");

describe("certificationScoring", () => {
  it("computes reliability as successes / attempts", () => {
    expect(computeReliabilityScore(2, 2)).toBe(100);
    expect(computeReliabilityScore(1, 2)).toBe(50);
    expect(computeReliabilityScore(0, 2)).toBe(0);
  });

  it("averages successful runs only", () => {
    const aggregated = aggregateCertificationResults(
      [
        {
          success: true,
          resumeScore: 90,
          emailScore: 86,
          certificationScore: 88,
          confidence: 80,
          costUsd: 0.003,
          latencyMs: 9000,
        },
        {
          success: true,
          resumeScore: 92,
          emailScore: 84,
          certificationScore: 88,
          confidence: 84,
          costUsd: 0.002,
          latencyMs: 8500,
        },
      ],
      2
    );

    expect(aggregated.resumeScore).toBe(91);
    expect(aggregated.emailScore).toBe(85);
    expect(aggregated.certificationScore).toBe(88);
    expect(aggregated.judgeConfidence).toBe(82);
    expect(aggregated.reliabilityScore).toBe(100);
    expect(aggregated.passed).toBe(true);
  });

  it("handles one failed attempt", () => {
    const aggregated = aggregateCertificationResults(
      [
        {
          success: true,
          resumeScore: 90,
          emailScore: 86,
          certificationScore: 88,
          confidence: 80,
          costUsd: 0.003,
          latencyMs: 9000,
        },
        { success: false, error: "timeout", costUsd: 0.001, latencyMs: 45000 },
      ],
      2
    );

    expect(aggregated.reliabilityScore).toBe(50);
    expect(aggregated.resumeScore).toBe(90);
  });

  it("overall score blends certification value and reliability", () => {
    const normalizedValue = normalizeValueScore(30000, 30000);
    const overall = computeOverallScore(88, normalizedValue, 100);
    expect(overall).toBeGreaterThan(80);
    expect(overall).toBeLessThanOrEqual(100);
  });

  it("preserves structured attempt errors in scores_json", () => {
    const structured = { step: "resume_parse", message: "Schema validation failed", attempt: 1 };
    const aggregated = aggregateCertificationResults(
      [{ success: false, error: structured, costUsd: 0, latencyMs: 100 }],
      2
    );

    expect(aggregated.scoresJson.runs[0].error).toEqual(structured);
    expect(formatAttemptError(structured)).toBe("resume_parse: Schema validation failed");
  });
});
