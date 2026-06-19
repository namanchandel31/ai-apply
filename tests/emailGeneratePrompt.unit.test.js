const {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildEmailUserPrompt,
} = require("../src/prompts/emailGeneratePrompt");

describe("emailGeneratePrompt", () => {
  it("exports v4 prompt version", () => {
    expect(PROMPT_VERSION).toBe("email_generate_v4");
  });

  it("SYSTEM_PROMPT includes mandatory email envelope", () => {
    expect(SYSTEM_PROMPT).toMatch(/MANDATORY EMAIL SHAPE/i);
    expect(SYSTEM_PROMPT).toMatch(/Salutation/i);
    expect(SYSTEM_PROMPT).toMatch(/Sign-off/i);
    expect(SYSTEM_PROMPT).toMatch(/Sender full name/i);
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
    expect(prompt).toContain("Envelope (fixed for every email");
    expect(prompt).toContain("Middle body layout (structured)");
    expect(prompt).toContain("Frontend Engineer");
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("react");
    expect(prompt).toContain("startup");
  });
});
