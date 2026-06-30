const crypto = require("crypto");
const config = require("../config");
const { createEphemeralRedisClient } = require("../queues/connection");
const { getProvider } = require("./email/providerRegistry");
const emailAccountModel = require("../models/emailAccountModel");
const { encryptSecret, decryptSecret } = require("../utils/encryption");
const { recordProviderEvent, EVENT_TYPES } = require("../models/emailProviderEventModel");
const { logInfo, logError } = require("../utils/logger");

const STATE_TTL_SEC = 600;
const STATE_PREFIX = "gmail:oauth:state:";
const PROVIDER = "gmail";

function gmailConfigured() {
  return config.google.isConfigured();
}

function assertConfigured() {
  if (!gmailConfigured()) {
    const err = new Error("Gmail integration is not configured on this server");
    err.code = "GMAIL_NOT_CONFIGURED";
    throw err;
  }
}

/** Resolve the OAuth scopes for a requested tier. Read scope only when flag-enabled. */
function resolveScopes(tier) {
  const { scopes, readTierEnabled } = config.google;
  const requested = [scopes.userinfoEmail, scopes.send];
  if (tier === "send_read" && readTierEnabled) {
    requested.push(scopes.readonly);
  }
  return requested;
}

/** Effective tier: downgrade send_read to send unless the read tier flag is on. */
function effectiveTier(tier) {
  if (tier === "send_read" && config.google.readTierEnabled) return "send_read";
  return "send";
}

async function withRedis(fn) {
  const client = createEphemeralRedisClient("gmail_oauth_state");
  try {
    await client.connect();
    return await fn(client);
  } finally {
    if (client.status !== "end") await client.quit().catch(() => {});
  }
}

async function createState(userId, tier, returnTo = "setup") {
  const state = crypto.randomBytes(24).toString("hex");
  const payload = JSON.stringify({ userId, tier, returnTo });
  await withRedis((client) => client.set(`${STATE_PREFIX}${state}`, payload, "EX", STATE_TTL_SEC));
  return state;
}

async function consumeState(state) {
  if (typeof state !== "string" || !state.trim()) {
    const err = new Error("Missing OAuth state");
    err.code = "INVALID_STATE";
    throw err;
  }
  const key = `${STATE_PREFIX}${state.trim()}`;
  const raw = await withRedis(async (client) => {
    const value = await client.get(key);
    if (value) await client.del(key);
    return value;
  });
  if (!raw) {
    const err = new Error("OAuth state is invalid or expired");
    err.code = "INVALID_STATE";
    throw err;
  }
  return JSON.parse(raw);
}

/** Builds the Google consent URL for the given user + tier. */
async function getConnectUrl(userId, tier, loginHint, returnTo = "setup") {
  assertConfigured();
  const resolvedTier = effectiveTier(tier);
  const state = await createState(userId, resolvedTier, returnTo);
  const authorizationUrl = getProvider(PROVIDER).getAuthorizationUrl({
    scopes: resolveScopes(resolvedTier),
    state,
    loginHint,
  });
  return { authorizationUrl };
}

/**
 * Handles the OAuth callback: validates state, exchanges the code, persists the
 * encrypted tokens + granted scopes, and records an audit event.
 */
async function handleCallback({ code, state }) {
  assertConfigured();
  if (!code) {
    const err = new Error("Missing authorization code");
    err.code = "INVALID_CODE";
    throw err;
  }

  const { userId, returnTo } = await consumeState(state);
  const provider = getProvider(PROVIDER);
  const identity = await provider.exchangeCode(code);

  const { scopes } = config.google;
  const grantedScopes = identity.grantedScopes || [];
  const canSend = grantedScopes.includes(scopes.send);
  const canRead = grantedScopes.includes(scopes.readonly);

  if (!canSend) {
    const err = new Error("Gmail send permission was not granted");
    err.code = "SEND_SCOPE_MISSING";
    throw err;
  }

  const account = await emailAccountModel.upsertOAuthAccount({
    userId,
    provider: PROVIDER,
    authMethod: "oauth2",
    emailAddress: identity.email,
    providerAccountId: identity.providerAccountId,
    grantedScopes,
    canSend,
    canRead,
    encryptedRefreshToken: identity.refreshToken ? encryptSecret(identity.refreshToken) : null,
    encryptedAccessToken: identity.accessToken ? encryptSecret(identity.accessToken) : null,
    accessTokenExpiresAt: identity.expiresAt || null,
  });

  await recordProviderEvent({
    userId,
    emailAccountId: account.id,
    provider: PROVIDER,
    eventType: EVENT_TYPES.GMAIL_CONNECTED,
    metadata: { email: identity.email, canSend, canRead, scopes: grantedScopes },
  });

  logInfo("GMAIL_CONNECTED", { userId, accountId: account.id, canSend, canRead });
  try {
    const { trackGmailConnected } = require("../observability/posthogAnalytics");
    trackGmailConnected(userId, { connection_method: "oauth", can_send: canSend });
  } catch {
    /* non-blocking */
  }
  return { userId, email: identity.email, canSend, canRead, returnTo: returnTo || "setup" };
}

/** Connection status for the user's Gmail account (if any). */
async function getStatus(userId) {
  const account = await emailAccountModel.getByUserAndProvider(userId, PROVIDER);
  if (!account) {
    return { connected: false, provider: PROVIDER, configured: gmailConfigured() };
  }
  return {
    connected: account.status === "connected",
    provider: PROVIDER,
    configured: gmailConfigured(),
    email: account.email_address,
    status: account.status,
    healthStatus: account.health_status,
    scopes: account.granted_scopes,
    canSend: account.can_send,
    canRead: account.can_read,
    isDefault: account.is_default,
    lastUsedAt: account.last_used_at,
  };
}

/** Revokes at Google (best-effort) and removes the stored Gmail account. */
async function disconnect(userId) {
  const account = await emailAccountModel.getByUserAndProvider(userId, PROVIDER);
  if (!account) return { disconnected: true, alreadyDisconnected: true };

  const tokenToRevoke =
    decryptSecret(account.encrypted_refresh_token) || decryptSecret(account.encrypted_access_token);
  if (tokenToRevoke) {
    try {
      await getProvider(PROVIDER).revoke(tokenToRevoke);
    } catch (err) {
      // Revocation failure should not block local disconnect.
      logError("GMAIL_REVOKE_FAILED", err, { userId, accountId: account.id });
    }
  }

  // Record before delete so the event row still references the account id
  // (FK is ON DELETE SET NULL, so it nullifies afterward but the row persists).
  await recordProviderEvent({
    userId,
    emailAccountId: account.id,
    provider: PROVIDER,
    eventType: EVENT_TYPES.GMAIL_DISCONNECTED,
    metadata: { email: account.email_address },
  });

  await emailAccountModel.deleteById(account.id);
  logInfo("GMAIL_DISCONNECTED", { userId, accountId: account.id });
  return { disconnected: true };
}

module.exports = {
  gmailConfigured,
  resolveScopes,
  effectiveTier,
  createState,
  consumeState,
  getConnectUrl,
  handleCallback,
  getStatus,
  disconnect,
  STATE_TTL_SEC,
};
