const { validateModelForProvider } = require("../src/services/modelValidation");

describe("modelValidation", () => {
  it("rejects unknown provider", () => {
    const r = validateModelForProvider({ provider: "unknown", model: "x" });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("INVALID_PROVIDER");
  });

  it("accepts valid openai model", () => {
    const r = validateModelForProvider({
      provider: "openai",
      model: "gpt-4.1-mini",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects invalid model for provider", () => {
    const r = validateModelForProvider({
      provider: "openai",
      model: "claude-3-5-haiku",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("INVALID_MODEL_FOR_PROVIDER");
  });

  it("allows local provider save without task", () => {
    const r = validateModelForProvider({
      provider: "ollama",
      providerType: "local",
      task: null,
    });
    expect(r.valid).toBe(true);
  });

  it("blocks local provider execution with task", () => {
    const r = validateModelForProvider({
      provider: "ollama",
      providerType: "local",
      task: "jd_parse",
    });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("LOCAL_PROVIDER_NOT_IMPLEMENTED");
  });
});
