const { buildContentValidationDiagnostics } = require("../src/services/jdParseValidation");

describe("jdParseValidation", () => {
  it("reports missing job_title from llm when enriched has title", () => {
    const d = buildContentValidationDiagnostics({
      llmData: { job_title: null, skills: [] },
      enrichedData: { job_title: "Flutter Developer", skills: ["flutter"], roles: ["Flutter Developer"] },
    });
    expect(d.hasUsableContent).toBe(true);
    expect(d.missingFields).not.toContain("job_title");
  });

  it("reports unusable when no title or skills", () => {
    const d = buildContentValidationDiagnostics({
      llmData: { job_title: null, skills: [] },
      enrichedData: { job_title: null, skills: [], roles: [] },
    });
    expect(d.hasUsableContent).toBe(false);
    expect(d.primaryFailure).toBe("no_usable_content");
  });
});
