const { enrichParsedJd } = require("../src/services/jdParseEnrichment");
const { PARSE_OUTCOMES } = require("../src/domain/jd/parseOutcomes");

describe("jdParseEnrichment", () => {
  it("infers Flutter Developer from multi-role LinkedIn post", () => {
    const rawText = `Open Positions:
• Flutter Developers
• AI/ML Engineers
• Data Engineers`;

    const result = enrichParsedJd({
      rawText,
      llmData: {
        job_title: null,
        roles: [],
        skills: [],
        company_name: null,
        contact_person: null,
        location: null,
        contact_email: null,
        contact_number: null,
        job_type: null,
      },
      resumeSkills: ["Flutter", "Dart"],
      promptVersion: "jd_parse_v2",
    });

    expect(result.data.job_title).toBe("Flutter Developer");
    expect(result.data.roles).toEqual(
      expect.arrayContaining(["Flutter Developer", "AI/ML Engineer", "Data Engineer"])
    );
    expect(result.data.skills.length).toBeGreaterThan(0);
    expect(result.isApplyEligible).toBe(true);
  });

  it("selects role matching resume skills", () => {
    const rawText = `Open Positions:
• Flutter Developers
• Data Engineers`;

    const result = enrichParsedJd({
      rawText,
      llmData: { job_title: null, roles: [], skills: [] },
      resumeSkills: ["Python", "ETL", "SQL"],
    });

    expect(result.data.job_title).toBe("Data Engineer");
  });

  it("flags spam content", () => {
    const result = enrichParsedJd({
      rawText: "Earn $5000 daily from crypto. DM for details. Work from phone.",
      llmData: { job_title: null, roles: [], skills: [] },
    });
    expect(result.parseOutcome).toBe(PARSE_OUTCOMES.SPAM_DETECTED);
    expect(result.isApplyEligible).toBe(false);
  });
});
