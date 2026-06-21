jest.mock("../src/models/emailAccountModel");
jest.mock("../src/models/emailProviderEventModel", () => ({
  EVENT_TYPES: {
    TOKEN_REFRESHED: "token_refreshed",
    TOKEN_REFRESH_FAILED: "token_refresh_failed",
    TOKEN_REVOKED: "token_revoked",
  },
  recordProviderEvent: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/email/providerRegistry", () => ({ getProvider: jest.fn() }));
jest.mock("../src/queues/connection", () => ({ createEphemeralRedisClient: jest.fn() }));

const emailAccountModel = require("../src/models/emailAccountModel");
const { getProvider } = require("../src/services/email/providerRegistry");
const { createEphemeralRedisClient } = require("../src/queues/connection");
const { recordProviderEvent } = require("../src/models/emailProviderEventModel");
const { getFreshAccessToken } = require("../src/services/oauthTokenService");

function mockLock(setResult = "OK") {
  const client = {
    status: "ready",
    connect: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(setResult),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined),
  };
  createEphemeralRedisClient.mockReturnValue(client);
  return client;
}

const future = () => new Date(Date.now() + 3600_000).toISOString();
const past = () => new Date(Date.now() - 1000).toISOString();

describe("oauthTokenService.getFreshAccessToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the cached access token when still fresh (no refresh, no lock)", async () => {
    const account = {
      id: "acc-1",
      user_id: "u1",
      provider: "gmail",
      encrypted_access_token: "gcm_LIVE",
      access_token_expires_at: future(),
    };
    const result = await getFreshAccessToken(account);
    expect(result.accessToken).toBe("LIVE");
    expect(createEphemeralRedisClient).not.toHaveBeenCalled();
    expect(getProvider).not.toHaveBeenCalled();
  });

  it("refreshes when expired and PRESERVES the refresh token when Google omits one", async () => {
    mockLock();
    const account = {
      id: "acc-2",
      user_id: "u1",
      provider: "gmail",
      encrypted_access_token: "gcm_OLD",
      access_token_expires_at: past(),
      encrypted_refresh_token: "gcm_REFRESH",
    };
    emailAccountModel.getById.mockResolvedValue(account);
    const refreshAccessToken = jest
      .fn()
      .mockResolvedValue({ accessToken: "NEW_AT", expiresAt: new Date(), refreshToken: null });
    getProvider.mockReturnValue({ refreshAccessToken });
    emailAccountModel.updateAccessToken.mockResolvedValue({ ...account, encrypted_access_token: "gcm_NEW_AT" });

    const result = await getFreshAccessToken(account);

    expect(refreshAccessToken).toHaveBeenCalledWith("REFRESH");
    expect(result.accessToken).toBe("NEW_AT");
    // No new refresh token -> encryptedRefreshToken must be null so the COALESCE keeps the old one.
    expect(emailAccountModel.updateAccessToken).toHaveBeenCalledWith(
      "acc-2",
      expect.objectContaining({ encryptedRefreshToken: null })
    );
    expect(recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "token_refreshed" })
    );
  });

  it("rotates the stored refresh token when Google returns a new one", async () => {
    mockLock();
    const account = {
      id: "acc-3",
      user_id: "u1",
      provider: "gmail",
      access_token_expires_at: past(),
      encrypted_refresh_token: "gcm_OLDREFRESH",
    };
    emailAccountModel.getById.mockResolvedValue(account);
    getProvider.mockReturnValue({
      refreshAccessToken: jest
        .fn()
        .mockResolvedValue({ accessToken: "AT", expiresAt: new Date(), refreshToken: "ROTATED" }),
    });
    emailAccountModel.updateAccessToken.mockResolvedValue(account);

    await getFreshAccessToken(account);

    expect(emailAccountModel.updateAccessToken).toHaveBeenCalledWith(
      "acc-3",
      expect.objectContaining({ encryptedRefreshToken: "gcm_ROTATED" })
    );
  });

  it("marks the account revoked and throws reauth on invalid_grant", async () => {
    mockLock();
    const account = {
      id: "acc-4",
      user_id: "u1",
      provider: "gmail",
      access_token_expires_at: past(),
      encrypted_refresh_token: "gcm_REFRESH",
    };
    emailAccountModel.getById.mockResolvedValue(account);
    const err = new Error("Bad Request");
    err.response = { data: { error: "invalid_grant" } };
    getProvider.mockReturnValue({ refreshAccessToken: jest.fn().mockRejectedValue(err) });

    await expect(getFreshAccessToken(account)).rejects.toMatchObject({
      code: "EMAIL_REAUTH_REQUIRED",
    });
    expect(emailAccountModel.markStatus).toHaveBeenCalledWith("acc-4", "revoked", "invalid_grant");
  });

  it("throws reauth when the refresh token is missing", async () => {
    mockLock();
    const account = {
      id: "acc-5",
      user_id: "u1",
      provider: "gmail",
      access_token_expires_at: past(),
      encrypted_refresh_token: null,
    };
    emailAccountModel.getById.mockResolvedValue(account);

    await expect(getFreshAccessToken(account)).rejects.toMatchObject({
      code: "EMAIL_REAUTH_REQUIRED",
    });
    expect(emailAccountModel.markStatus).toHaveBeenCalledWith(
      "acc-5",
      "revoked",
      "missing refresh token"
    );
  });
});
