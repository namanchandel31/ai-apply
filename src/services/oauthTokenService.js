const crypto = require("crypto");
const { getProvider } = require("./email/providerRegistry");
const emailAccountModel = require("../models/emailAccountModel");
const { encryptSecret, decryptSecret } = require("../utils/encryption");
const { createEphemeralRedisClient } = require("../queues/connection");
const { recordProviderEvent, EVENT_TYPES } = require("../models/emailProviderEventModel");
const { ReauthRequiredError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");

// Refresh when the cached access token has under this much life left.
const ACCESS_TOKEN_SKEW_MS = 60_000;
// Per-account refresh lock: TTL caps a crashed holder; wait bounds contention.
const LOCK_TTL_MS = 10_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_POLL_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function accessTokenIsFresh(account) {
  if (!account.encrypted_access_token || !account.access_token_expires_at) return false;
  const expMs = new Date(account.access_token_expires_at).getTime();
  return Number.isFinite(expMs) && Date.now() + ACCESS_TOKEN_SKEW_MS < expMs;
}

/** Detects Google's "refresh token no longer valid" signal across error shapes. */
function isInvalidGrant(err) {
  const fromData = err?.response?.data?.error || err?.response?.data?.error_description;
  const msg = `${err?.message || ""} ${fromData || ""}`;
  return /invalid_grant/i.test(msg);
}

async function withAccountLock(accountId, fn) {
  const client = createEphemeralRedisClient("oauth_token_lock");
  const key = `oauth:token:lock:${accountId}`;
  const token = crypto.randomUUID();
  let acquired = false;
  try {
    await client.connect();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      const res = await client.set(key, token, "PX", LOCK_TTL_MS, "NX");
      if (res === "OK") {
        acquired = true;
        break;
      }
      await sleep(LOCK_POLL_MS);
    }
    return await fn(acquired);
  } finally {
    if (acquired) {
      try {
        const cur = await client.get(key);
        if (cur === token) await client.del(key);
      } catch {
        /* best-effort release; TTL will expire it */
      }
    }
    if (client.status !== "end") {
      await client.quit().catch(() => {});
    }
  }
}

async function refreshAndPersist(account) {
  const refreshToken = decryptSecret(account.encrypted_refresh_token);
  if (!refreshToken) {
    await emailAccountModel.markStatus(account.id, "revoked", "missing refresh token");
    await recordProviderEvent({
      userId: account.user_id,
      emailAccountId: account.id,
      provider: account.provider,
      eventType: EVENT_TYPES.TOKEN_REVOKED,
      metadata: { reason: "missing_refresh_token" },
    });
    throw new ReauthRequiredError(
      "Your connected email account needs to be reconnected (no refresh token)."
    );
  }

  const provider = getProvider(account.provider);
  let refreshed;
  try {
    refreshed = await provider.refreshAccessToken(refreshToken);
  } catch (err) {
    if (isInvalidGrant(err)) {
      await emailAccountModel.markStatus(account.id, "revoked", "invalid_grant");
      await recordProviderEvent({
        userId: account.user_id,
        emailAccountId: account.id,
        provider: account.provider,
        eventType: EVENT_TYPES.TOKEN_REVOKED,
        metadata: { reason: "invalid_grant" },
      });
      throw new ReauthRequiredError(
        "Your connected email account was revoked. Please reconnect it."
      );
    }
    await recordProviderEvent({
      userId: account.user_id,
      emailAccountId: account.id,
      provider: account.provider,
      eventType: EVENT_TYPES.TOKEN_REFRESH_FAILED,
      metadata: { message: err?.message },
    });
    logError("OAUTH_TOKEN_REFRESH_FAILED", err, { accountId: account.id, provider: account.provider });
    throw err;
  }

  // Preserve the existing refresh token unless Google returned a new one.
  const newEncryptedRefresh = refreshed.refreshToken
    ? encryptSecret(refreshed.refreshToken)
    : null;

  const updated = await emailAccountModel.updateAccessToken(account.id, {
    encryptedAccessToken: encryptSecret(refreshed.accessToken),
    accessTokenExpiresAt: refreshed.expiresAt || null,
    encryptedRefreshToken: newEncryptedRefresh,
  });

  await recordProviderEvent({
    userId: account.user_id,
    emailAccountId: account.id,
    provider: account.provider,
    eventType: EVENT_TYPES.TOKEN_REFRESHED,
    metadata: { rotatedRefreshToken: Boolean(refreshed.refreshToken) },
  });
  logInfo("OAUTH_TOKEN_REFRESHED", { accountId: account.id, provider: account.provider });

  return { accessToken: refreshed.accessToken, account: updated || account };
}

/**
 * Returns a valid access token for an OAuth account, refreshing if needed.
 * Concurrency-safe via a per-account Redis lock so parallel send jobs don't all
 * hit Google at once. Throws ReauthRequiredError (non-retryable) when the grant is gone.
 *
 * @returns {Promise<{ accessToken: string, account: object }>}
 */
async function getFreshAccessToken(account) {
  if (accessTokenIsFresh(account)) {
    return { accessToken: decryptSecret(account.encrypted_access_token), account };
  }

  return withAccountLock(account.id, async (acquired) => {
    // Re-read under the lock: another worker may have just refreshed.
    const latest = (await emailAccountModel.getById(account.id)) || account;
    if (accessTokenIsFresh(latest)) {
      return { accessToken: decryptSecret(latest.encrypted_access_token), account: latest };
    }
    if (!acquired) {
      logInfo("OAUTH_TOKEN_REFRESH_NO_LOCK", { accountId: account.id });
    }
    return refreshAndPersist(latest);
  });
}

module.exports = {
  getFreshAccessToken,
  isInvalidGrant,
  // exported for tests
  accessTokenIsFresh,
};
