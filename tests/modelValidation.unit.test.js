const { validateModelForProvider } = require("../src/services/modelValidation");

describe("modelValidation", () => {
  it("rejects unknown provider", () => {
    const r = validateModelForProvider({ provider: "unknown", model: "x" });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("INVALID_PROVIDER");
  });

  it("accepts arbitrary lowercase model for openai (no prefix check)", () => {
    const r = validateModelForProvider({
      provider: "openai",
      model: "vendor/future-model-99",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(true);
    expect(r.model).toBe("vendor/future-model-99");
  });

  it("normalizes model casing", () => {
    const r = validateModelForProvider({
      provider: "openai",
      model: "GPT-4.1-MINI",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(true);
    expect(r.model).toBe("gpt-4.1-mini");
    expect(r.normalizedFrom).toBe("GPT-4.1-MINI");
  });

  it("rejects invalid charset", () => {
    const r = validateModelForProvider({
      provider: "openai",
      model: "claude@anthropic",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("INVALID_MODEL_FORMAT");
  });

  it("requires model for remote providers", () => {
    const r = validateModelForProvider({
      provider: "openai",
      providerType: "remote",
      task: "resume_parse",
    });
    expect(r.valid).toBe(false);
    expect(r.code).toBe("MODEL_REQUIRED");
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
