const { normalizeModelInput, MODEL_MAX_LENGTH } = require("../src/utils/normalizeModelInput");

describe("normalizeModelInput", () => {
  it("lowercases mixed-case ASCII model ids", () => {
    expect(normalizeModelInput("OpenAI/GPT-4O", { required: true })).toEqual({
      ok: true,
      model: "openai/gpt-4o",
      normalizedFrom: "OpenAI/GPT-4O",
    });
    expect(normalizeModelInput("GPT-4O", { required: true })).toEqual({
      ok: true,
      model: "gpt-4o",
      normalizedFrom: "GPT-4O",
    });
  });

  it("allows colon dot slash underscore hyphen", () => {
    expect(normalizeModelInput("provider:meta/llama-3.1", { required: true })).toEqual({
      ok: true,
      model: "provider:meta/llama-3.1",
    });
  });

  it("rejects non-ASCII characters", () => {
    expect(normalizeModelInput("café-model", { required: true }).ok).toBe(false);
    expect(normalizeModelInput("модель", { required: true }).ok).toBe(false);
    expect(normalizeModelInput("gpt-4😀", { required: true }).ok).toBe(false);
  });

  it("rejects whitespace and disallowed punctuation", () => {
    expect(normalizeModelInput("gpt 4", { required: true }).code).toBe("INVALID_MODEL_FORMAT");
    expect(normalizeModelInput("gpt\t4", { required: true }).code).toBe("INVALID_MODEL_FORMAT");
    expect(normalizeModelInput("gpt@openai", { required: true }).code).toBe("INVALID_MODEL_FORMAT");
    expect(normalizeModelInput("#gpt", { required: true }).code).toBe("INVALID_MODEL_FORMAT");
  });

  it("rejects empty when required", () => {
    expect(normalizeModelInput("", { required: true })).toMatchObject({
      ok: false,
      code: "MODEL_REQUIRED",
    });
    expect(normalizeModelInput("   ", { required: true })).toMatchObject({
      ok: false,
      code: "MODEL_REQUIRED",
    });
  });

  it("allows null when not required", () => {
    expect(normalizeModelInput(null)).toEqual({ ok: true, model: null });
  });

  it("rejects over max length", () => {
    const long = "a".repeat(MODEL_MAX_LENGTH + 1);
    expect(normalizeModelInput(long, { required: true }).code).toBe("INVALID_MODEL_FORMAT");
  });
});
