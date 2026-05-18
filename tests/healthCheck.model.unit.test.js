const { createOpenAICompatibleProvider } = require("../src/providers/openaiCompatibleCore");

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: jest.fn().mockResolvedValue({ output_text: "ok" }),
    },
  }));
});

describe("openaiCompatible healthCheck model probe", () => {
  it("probes with canonical lowercase model", async () => {
    const provider = createOpenAICompatibleProvider({
      id: "openai",
      capabilities: {},
    });
    const result = await provider.healthCheck({
      credentials: { apiKey: "sk-test" },
      model: "GPT-4.1-MINI",
    });
    expect(result.ok).toBe(true);
    expect(result.model).toBe("gpt-4.1-mini");

    const OpenAI = require("openai");
    const client = OpenAI.mock.results[0].value;
    expect(client.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4.1-mini" }),
      expect.any(Object)
    );
  });

  it("rejects invalid charset before API call", async () => {
    const provider = createOpenAICompatibleProvider({
      id: "openai",
      capabilities: {},
    });
    const result = await provider.healthCheck({
      credentials: { apiKey: "sk-test" },
      model: "bad model",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_MODEL_FORMAT");
  });
});
