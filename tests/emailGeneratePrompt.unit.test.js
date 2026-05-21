const {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildEmailUserPrompt,
} = require("../src/prompts/emailGeneratePrompt");

describe("emailGeneratePrompt", () => {
  it("exports v2 prompt version", () => {
    expect(PROMPT_VERSION).toBe("email_generate_v2");
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
    });
    expect(prompt).toContain("Frontend Engineer");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("react");
    expect(prompt).toContain("startup");
  });
});
