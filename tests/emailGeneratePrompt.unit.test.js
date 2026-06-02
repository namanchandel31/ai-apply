const {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildEmailUserPrompt,
} = require("../src/prompts/emailGeneratePrompt");

describe("emailGeneratePrompt", () => {
  it("exports v3 prompt version", () => {
    expect(PROMPT_VERSION).toBe("email_generate_v3");
  });

  it("SYSTEM_PROMPT includes imperfection and anti-AI-punctuation rules", () => {
    expect(SYSTEM_PROMPT).toMatch(/imperfection|uneven/i);
    expect(SYSTEM_PROMPT).toMatch(/em dash|en dash/i);
    expect(SYSTEM_PROMPT).toMatch(/STRICT BANS/i);
    expect(SYSTEM_PROMPT).toMatch(/excited to apply/i);
  });

  it("buildEmailUserPrompt includes job and candidate blocks", () => {
    const prompt = buildEmailUserPrompt({
      candidate: { name: "Jane Doe", skills: ["react", "node"] },
      job: { title: "Frontend Engineer", company: "Acme", requiredSkills: ["react"] },
      match: { score: 80, matchedSkills: ["react"] },
      toneContext: {
        companyStyle: "startup",
        communicationTone: "concise",
        hiringSignal: "growth",
        environmentType: "remote_first",
      },
      personalizationContext: {},
      emailPreferences: {
        toneProfile: "professional",
        structureMode: "structured",
        targetWordRange: { min: 140, max: 200 },
        seniorityBand: "mid",
      },
    });
    expect(prompt).toContain("User tone profile (professional)");
    expect(prompt).toContain("Structure:");
    expect(prompt).toContain("Frontend Engineer");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("react");
    expect(prompt).toContain("startup");
  });
});
