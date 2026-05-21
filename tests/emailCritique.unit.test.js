const {
  synthesizeEmailCritique,
  buildTargetedRewriteGuidance,
} = require("../src/services/emailCritique");

describe("emailCritique", () => {
  it("critique references specific issues not generic humanize", () => {
    const critique = synthesizeEmailCritique({
      hardFailures: [],
      validationSignals: { bannedPhraseScore: 50, stackDumpingScore: 40 },
      scores: { realism: { aiDetectabilityRisk: 80 } },
      openingAnalysis: {
        weakPatterns: ["i am excited to apply"],
        score: 30,
      },
      draft: {
        body: "I am excited to apply. I use React, Vue, Angular, Django, and Kubernetes daily.",
      },
    });
    expect(critique).toMatch(/opening|tool|stack/i);
    expect(critique.toLowerCase()).not.toBe("make it more human");
  });

  it("rewrite guidance targets sections not full regen", () => {
    const guidance = buildTargetedRewriteGuidance(
      "Opening feels generic. Middle section is dense.",
      { body: "Para one.\n\nPara two dense text.\n\nPara three." }
    );
    expect(guidance).toMatch(/REWRITE ONLY|Keep strong/i);
    expect(guidance).toMatch(/paragraph/i);
  });
});
