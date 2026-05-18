/**
 * Multi-credential chain: primary fails → backup key used.
 */
jest.mock("../src/services/aiCredentialService", () => ({
  resolveCredentialsForUser: jest.fn(),
  resolveCredentialChainForUser: jest.fn(),
  resolvePlatformCredentials: jest.fn(() => null),
  updateCredentialHealth: jest.fn(),
  markCredentialSuccess: jest.fn(),
}));

jest.mock("../src/providers", () => {
  const { RetryableError } = require("../src/utils/errors");
  const mockOpenai = {
    capabilities: { supportsStructuredJson: true, supportsText: true },
    generateStructuredJson: jest.fn().mockRejectedValue(new RetryableError("primary fail")),
    healthCheck: jest.fn().mockResolvedValue({ ok: true }),
  };
  const mockAnthropic = {
    capabilities: { supportsStructuredJson: true, supportsText: true },
    generateStructuredJson: jest.fn().mockResolvedValue({
      parsed: { ok: true },
      provider: "anthropic",
      model: "claude-3-5-haiku-20241022",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      estimatedCost: 0,
    }),
    healthCheck: jest.fn().mockResolvedValue({ ok: true }),
  };
  return {
    getProvider: (id) => (id === "anthropic" ? mockAnthropic : mockOpenai),
    REGISTRY: { openai: mockOpenai, anthropic: mockAnthropic },
  };
});

const {
  resolveCredentialsForUser,
  resolveCredentialChainForUser,
} = require("../src/services/aiCredentialService");
const { generateStructuredJson } = require("../src/services/aiGateway");

describe("aiGateway credential chain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses backup credential when primary fails with retryable error", async () => {
    const primary = {
      credentialId: "id-1",
      provider: "openai",
      providerType: "remote",
      apiKey: "sk-primary",
      model: "gpt-4.1-mini",
      credentialSource: "user",
      allowPlatformFallback: false,
      healthStatus: "healthy",
      inFallbackChain: true,
      priority: 0,
    };
    const backup = {
      credentialId: "id-2",
      provider: "anthropic",
      providerType: "remote",
      apiKey: "sk-backup",
      model: "claude-3-5-haiku-20241022",
      credentialSource: "user",
      allowPlatformFallback: false,
      healthStatus: "healthy",
      inFallbackChain: true,
      priority: 1,
    };

    resolveCredentialsForUser.mockResolvedValue(primary);
    resolveCredentialChainForUser.mockResolvedValue([primary, backup]);

    const result = await generateStructuredJson({
      userId: "user-1",
      task: "jd_parse",
      systemPrompt: "sys",
      userPrompt: "hello",
    });

    expect(result).toEqual({ ok: true });
  });
});
