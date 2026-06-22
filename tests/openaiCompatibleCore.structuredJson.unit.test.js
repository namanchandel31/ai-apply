const { RetryableError } = require("../src/utils/errors");
const { createOpenAICompatibleProvider } = require("../src/providers/openaiCompatibleCore");

const jsonValidationError = Object.assign(new Error("Failed to validate JSON"), {
  status: 400,
});

function mockOpenAIClient({ responsesResults = [], chatResults = [] }) {
  let responsesCall = 0;
  let chatCall = 0;
  return {
    responses: {
      create: jest.fn(async () => {
        const result = responsesResults[responsesCall];
        responsesCall += 1;
        if (result instanceof Error) throw result;
        return result;
      }),
    },
    chat: {
      completions: {
        create: jest.fn(async () => {
          const result = chatResults[chatCall];
          chatCall += 1;
          if (result instanceof Error) throw result;
          return result;
        }),
      },
    },
  };
}

jest.mock("openai", () => {
  return jest.fn();
});

describe("openaiCompatibleCore structured JSON retries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries Groq responses API then falls back to chat completions", async () => {
    const OpenAI = require("openai");
    OpenAI.mockImplementation(() =>
      mockOpenAIClient({
        responsesResults: [jsonValidationError],
        chatResults: [
          {
            choices: [{ message: { content: '{"subject":"Hello there","body":"Hi,\\n\\nBody text here with enough words to pass validation comfortably in tests.\\n\\nBest,\\nTest User"}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 },
          },
        ],
      })
    );

    const provider = createOpenAICompatibleProvider({
      id: "groq",
      defaultBaseUrl: "https://api.groq.com/openai/v1",
      capabilities: {},
    });

    const result = await provider.generateStructuredJson({
      systemPrompt: "Return JSON",
      userPrompt: "Write email",
      model: "openai/gpt-oss-120b",
      credentials: { apiKey: "gsk-test" },
    });

    expect(result.parsed).toEqual(
      expect.objectContaining({ subject: "Hello there" })
    );
    const client = OpenAI.mock.results[0].value;
    expect(client.responses.create).toHaveBeenCalledTimes(1);
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it("retries non-Groq providers on retryable JSON failures", async () => {
    const OpenAI = require("openai");
    OpenAI.mockImplementation(() =>
      mockOpenAIClient({
        responsesResults: [
          jsonValidationError,
          { output_text: '{"ok":true}', usage: { prompt_tokens: 1, completion_tokens: 1 } },
        ],
      })
    );

    const provider = createOpenAICompatibleProvider({
      id: "openai",
      capabilities: {},
    });

    const result = await provider.generateStructuredJson({
      systemPrompt: "Return JSON",
      userPrompt: "hello",
      model: "gpt-4.1-mini",
      credentials: { apiKey: "sk-test" },
    });

    expect(result.parsed).toEqual({ ok: true });
    const client = OpenAI.mock.results[0].value;
    expect(client.responses.create).toHaveBeenCalledTimes(2);
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });

  it("throws after exhausting structured JSON attempts", async () => {
    const OpenAI = require("openai");
    OpenAI.mockImplementation(() =>
      mockOpenAIClient({
        responsesResults: [jsonValidationError, jsonValidationError, jsonValidationError],
      })
    );

    const provider = createOpenAICompatibleProvider({
      id: "openai",
      capabilities: {},
    });

    await expect(
      provider.generateStructuredJson({
        systemPrompt: "Return JSON",
        userPrompt: "hello",
        model: "gpt-4.1-mini",
        credentials: { apiKey: "sk-test" },
      })
    ).rejects.toBeInstanceOf(RetryableError);
  });
});
