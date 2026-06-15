const crypto = require("crypto");
const { createEphemeralRedisClient } = require("../queues/connection");
const config = require("../config");

const CONNECT_TOKEN_TTL_SEC = 90;
const REDIS_KEY_PREFIX = "extension:connect:";

function validateConnectInitBody(body) {
  if (!body || typeof body !== "object") {
    const err = new Error("Request body is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  const { accessToken, refreshToken, expiresAt } = body;
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    const err = new Error("accessToken is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    const err = new Error("refreshToken is required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (!Number.isFinite(expiresAt)) {
    const err = new Error("expiresAt must be a number");
    err.code = "BAD_REQUEST";
    throw err;
  }
  return {
    accessToken: accessToken.trim(),
    refreshToken: refreshToken.trim(),
    expiresAt: Math.floor(expiresAt),
    apiBase: typeof body.apiBase === "string" && body.apiBase.trim()
      ? body.apiBase.trim().replace(/\/$/, "")
      : null,
  };
}

function resolveDefaultApiBase() {
  if (config.server.isProduction) {
    return null;
  }
  return `http://localhost:${config.server.port}`;
}

async function withRedisClient(fn) {
  const client = createEphemeralRedisClient("extension_connect");
  try {
    await client.connect();
    return await fn(client);
  } finally {
    if (client.status !== "end") {
      await client.quit();
    }
  }
}

async function createConnectToken(userId, bundle) {
  const connectToken = crypto.randomUUID();
  const key = `${REDIS_KEY_PREFIX}${connectToken}`;
  const payload = JSON.stringify({
    userId,
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    expiresAt: bundle.expiresAt,
    apiBase: bundle.apiBase || resolveDefaultApiBase(),
  });

  await withRedisClient(async (client) => {
    await client.set(key, payload, "EX", CONNECT_TOKEN_TTL_SEC);
  });

  return { connectToken, expiresIn: CONNECT_TOKEN_TTL_SEC };
}

async function exchangeConnectToken(connectToken) {
  if (typeof connectToken !== "string" || !connectToken.trim()) {
    const err = new Error("connectToken is required");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const key = `${REDIS_KEY_PREFIX}${connectToken.trim()}`;

  return withRedisClient(async (client) => {
    const raw = await client.get(key);
    if (!raw) {
      const err = new Error("Connect token is invalid or expired");
      err.code = "CONNECT_TOKEN_EXPIRED";
      throw err;
    }

    await client.del(key);

    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      apiBase: parsed.apiBase,
    };
  });
}

module.exports = {
  CONNECT_TOKEN_TTL_SEC,
  validateConnectInitBody,
  createConnectToken,
  exchangeConnectToken,
};
