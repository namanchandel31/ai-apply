/**
 * BYOK fallback policy: user credentials must not use platform keys without opt-in.
 */
jest.mock("../src/services/aiCredentialService", () => ({
  resolveCredentialsForUser: jest.fn(),
  resolveCredentialChainForUser: jest.fn(),
  updateCredentialHealth: jest.fn(),
  markCredentialSuccess: jest.fn(),
  resolvePlatformCredentials: jest.fn(() => ({
    provider: "openai",
    providerType: "remote",
    apiKey: "platform-key",
    model: "gpt-4.1-mini",
    credentialSource: "platform",
    allowPlatformFallback: true,
  })),
}));

jest.mock("../src/providers", () => {
  const { RetryableError } = require("../src/utils/errors");
  const stub = {
    capabilities: { supportsStructuredJson: true, supportsText: true },
    generateStructuredJson: jest.fn().mockRejectedValue(new RetryableError("fail")),
    healthCheck: jest.fn().mockResolvedValue({ ok: true }),
  };
  return {
    getProvider: () => stub,
    REGISTRY: { openai: stub },
  };
});

const {
  resolveCredentialsForUser,
  resolveCredentialChainForUser,
} = require("../src/services/aiCredentialService");
const { generateStructuredJson } = require("../src/services/aiGateway");

describe("aiGateway BYOK fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "platform-key";
  });

  it("does not call platform fallback when BYOK user has allow_platform_fallback false", async () => {
    const cred = {
      credentialId: "c1",
      provider: "openai",
      providerType: "remote",
      apiKey: "user-key",
      model: "gpt-4.1-mini",
      credentialSource: "user",
      allowPlatformFallback: false,
      healthStatus: "healthy",
      inFallbackChain: true,
      priority: 0,
    };
    resolveCredentialsForUser.mockResolvedValue(cred);
    resolveCredentialChainForUser.mockResolvedValue([cred]);

    await expect(
      generateStructuredJson({
        userId: "user-1",
        task: "jd_parse",
        systemPrompt: "sys",
        userPrompt: "hello",
      })
    ).rejects.toThrow();
  });
});
