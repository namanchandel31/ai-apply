const {
  CONNECT_TOKEN_TTL_SEC,
  validateConnectInitBody,
  createConnectToken,
  exchangeConnectToken,
} = require("../src/services/extensionConnectService");

jest.mock("../src/queues/connection", () => ({
  createEphemeralRedisClient: jest.fn(),
}));

const { createEphemeralRedisClient } = require("../src/queues/connection");

function mockRedisClient(store = new Map()) {
  const client = {
    status: "ready",
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(async (key, value, _ex, ttl) => {
      store.set(key, { value, ttl });
    }),
    get: jest.fn(async (key) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    }),
    del: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
  createEphemeralRedisClient.mockReturnValue(client);
  return { client, store };
}

describe("extensionConnectService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateConnectInitBody", () => {
    it("requires accessToken, refreshToken, and expiresAt", () => {
      expect(() => validateConnectInitBody(null)).toThrow("Request body is required");
      expect(() => validateConnectInitBody({})).toThrow("accessToken is required");
      expect(() =>
        validateConnectInitBody({ accessToken: "a", refreshToken: "r" })
      ).toThrow("expiresAt must be a number");
    });

    it("returns trimmed bundle", () => {
      const result = validateConnectInitBody({
        accessToken: "  token  ",
        refreshToken: "  refresh  ",
        expiresAt: 1718400000,
        apiBase: "http://localhost:5000/",
      });
      expect(result).toEqual({
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: 1718400000,
        apiBase: "http://localhost:5000",
      });
    });
  });

  it("exposes 90 second connect token TTL", () => {
    expect(CONNECT_TOKEN_TTL_SEC).toBe(90);
  });

  describe("createConnectToken", () => {
    it("stores bundle in Redis with TTL", async () => {
      const { client } = mockRedisClient();
      const result = await createConnectToken("user-1", {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 100,
        apiBase: "http://localhost:5000",
      });
      expect(result.connectToken).toBeTruthy();
      expect(result.expiresIn).toBe(90);
      expect(client.set).toHaveBeenCalledWith(
        `extension:connect:${result.connectToken}`,
        expect.any(String),
        "EX",
        90
      );
      expect(client.quit).toHaveBeenCalled();
    });
  });

  describe("exchangeConnectToken", () => {
    it("returns session and deletes token (single-use)", async () => {
      const store = new Map();
      const { client } = mockRedisClient(store);
      const bundle = {
        userId: "user-1",
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 100,
        apiBase: "http://localhost:5000",
      };
      const token = "test-token";
      store.set(`extension:connect:${token}`, { value: JSON.stringify(bundle) });

      const result = await exchangeConnectToken(token);
      expect(result).toEqual({
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 100,
        apiBase: "http://localhost:5000",
      });
      expect(client.del).toHaveBeenCalledWith(`extension:connect:${token}`);
      expect(client.quit).toHaveBeenCalled();
    });

    it("rejects missing connectToken", async () => {
      mockRedisClient();
      await expect(exchangeConnectToken("")).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects expired or unknown token", async () => {
      mockRedisClient();
      await expect(exchangeConnectToken("missing")).rejects.toMatchObject({
        code: "CONNECT_TOKEN_EXPIRED",
      });
    });

    it("rejects reused token on second exchange", async () => {
      const store = new Map();
      mockRedisClient(store);
      const token = "once-only";
      store.set(`extension:connect:${token}`, {
        value: JSON.stringify({
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: 100,
          apiBase: "http://localhost:5000",
        }),
      });

      await exchangeConnectToken(token);
      await expect(exchangeConnectToken(token)).rejects.toMatchObject({
        code: "CONNECT_TOKEN_EXPIRED",
      });
    });
  });
});
