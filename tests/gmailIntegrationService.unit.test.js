process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:5000/api/integrations/gmail/callback";
process.env.APP_BASE_URL = "http://localhost:5173";

const mockStore = new Map();
jest.mock("../src/queues/connection", () => ({
  createEphemeralRedisClient: jest.fn(() => ({
    status: "ready",
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(async (key, value) => mockStore.set(key, value)),
    get: jest.fn(async (key) => mockStore.get(key) ?? null),
    del: jest.fn(async (key) => mockStore.delete(key)),
  })),
}));

jest.mock("../src/services/email/providerRegistry", () => ({ getProvider: jest.fn() }));
jest.mock("../src/models/emailAccountModel");
jest.mock("../src/models/emailProviderEventModel", () => ({
  EVENT_TYPES: {
    GMAIL_CONNECTED: "gmail_connected",
    GMAIL_DISCONNECTED: "gmail_disconnected",
  },
  recordProviderEvent: jest.fn().mockResolvedValue({}),
}));

const { getProvider } = require("../src/services/email/providerRegistry");
const emailAccountModel = require("../src/models/emailAccountModel");
const { recordProviderEvent } = require("../src/models/emailProviderEventModel");
const service = require("../src/services/gmailIntegrationService");

const SEND = "https://www.googleapis.com/auth/gmail.send";
const READONLY = "https://www.googleapis.com/auth/gmail.readonly";

describe("gmailIntegrationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
  });

  it("requests gmail.send (not readonly) by default and downgrades send_read when flag off", () => {
    expect(service.effectiveTier("send_read")).toBe("send");
    const scopes = service.resolveScopes("send");
    expect(scopes).toContain(SEND);
    expect(scopes).not.toContain(READONLY);
  });

  it("round-trips a state token (single-use)", async () => {
    const state = await service.createState("user-1", "send");
    const consumed = await service.consumeState(state);
    expect(consumed).toEqual({ userId: "user-1", tier: "send" });
    await expect(service.consumeState(state)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("builds a connect URL via the provider", async () => {
    getProvider.mockReturnValue({ getAuthorizationUrl: jest.fn(() => "https://consent") });
    const { authorizationUrl } = await service.getConnectUrl("user-1", "send", "me@gmail.com");
    expect(authorizationUrl).toBe("https://consent");
  });

  it("handleCallback persists tokens, preserving refresh-token semantics, and records an event", async () => {
    const state = await service.createState("user-9", "send");
    getProvider.mockReturnValue({
      exchangeCode: jest.fn().mockResolvedValue({
        email: "me@gmail.com",
        providerAccountId: "sub-1",
        refreshToken: "RT",
        accessToken: "AT",
        expiresAt: new Date(),
        grantedScopes: [SEND, "openid"],
      }),
    });
    emailAccountModel.upsertOAuthAccount.mockResolvedValue({ id: "acc-1" });

    const result = await service.handleCallback({ code: "code-1", state });

    expect(result).toMatchObject({ email: "me@gmail.com", canSend: true, canRead: false });
    expect(emailAccountModel.upsertOAuthAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-9",
        provider: "gmail",
        canSend: true,
        canRead: false,
        encryptedRefreshToken: "gcm_RT",
      })
    );
    expect(recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "gmail_connected" })
    );
  });

  it("rejects the callback when gmail.send was not granted", async () => {
    const state = await service.createState("user-2", "send");
    getProvider.mockReturnValue({
      exchangeCode: jest.fn().mockResolvedValue({
        email: "me@gmail.com",
        grantedScopes: ["openid"],
      }),
    });
    await expect(service.handleCallback({ code: "c", state })).rejects.toMatchObject({
      code: "SEND_SCOPE_MISSING",
    });
  });

  it("disconnect revokes and deletes the account", async () => {
    emailAccountModel.getByUserAndProvider.mockResolvedValue({
      id: "acc-1",
      user_id: "user-3",
      email_address: "me@gmail.com",
      encrypted_refresh_token: "gcm_RT",
      encrypted_access_token: null,
    });
    const revoke = jest.fn().mockResolvedValue(undefined);
    getProvider.mockReturnValue({ revoke });

    const result = await service.disconnect("user-3");

    expect(revoke).toHaveBeenCalledWith("RT");
    expect(emailAccountModel.deleteById).toHaveBeenCalledWith("acc-1");
    expect(recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "gmail_disconnected" })
    );
    expect(result).toEqual({ disconnected: true });
  });
});
