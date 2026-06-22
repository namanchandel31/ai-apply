jest.mock("../src/services/settingsService", () => ({
  get: jest.fn().mockResolvedValue(true),
}));

jest.mock("../src/models/platformAiConfigModel", () => ({
  getGlobalConfig: jest.fn(),
  listActiveCredentialsForProvider: jest.fn(),
  pickWeightedCredential: jest.fn(),
}));

jest.mock("../src/utils/encryption", () => ({
  decrypt: jest.fn((value) => `plain-${value}`),
}));

const platformAiConfigModel = require("../src/models/platformAiConfigModel");
const platformAiConfigService = require("../src/services/platformAiConfigService");

describe("platformAiConfigService.resolveChain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformAiConfigService.invalidateCache();
  });

  it("returns weighted primary first with remaining keys as fallbacks", async () => {
    platformAiConfigModel.getGlobalConfig.mockResolvedValue({
      is_enabled: true,
      model_provider: "groq",
      model_id: "openai/gpt-oss-120b",
      model_is_active: true,
      certification_status: "certified",
      certified_model_id: "cm-1",
    });
    platformAiConfigModel.listActiveCredentialsForProvider.mockResolvedValue([
      { id: "key-a", encrypted_api_key: "a", is_active: true, traffic_weight: 50 },
      { id: "key-b", encrypted_api_key: "b", is_active: true, traffic_weight: 50 },
    ]);
    platformAiConfigModel.pickWeightedCredential.mockReturnValue({
      id: "key-b",
      encrypted_api_key: "b",
      is_active: true,
      traffic_weight: 50,
    });

    const chain = await platformAiConfigService.resolveChain("email_generate");

    expect(chain).toHaveLength(2);
    expect(chain[0].credentialId).toBe("key-b");
    expect(chain[1].credentialId).toBe("key-a");
    expect(chain[0].model).toBe("openai/gpt-oss-120b");
  });
});
