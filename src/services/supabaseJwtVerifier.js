const { createRemoteJWKSet, jwtVerify } = require("jose");
const { supabaseAuth } = require("../config");
const {
  logAuthVerifyFailed,
  logAuthEmailRejected,
  logAuthConfigReady,
} = require("./authObservability");

/** OAuth IdPs verify email before issuing tokens; Supabase sets app_metadata.provider. */
const OAUTH_EMAIL_VERIFIED_PROVIDERS = new Set([
  "google",
  "github",
  "gitlab",
  "apple",
  "azure",
  "facebook",
  "twitter",
  "discord",
  "linkedin",
  "linkedin_oidc",
  "bitbucket",
  "slack",
  "spotify",
  "twitch",
  "workos",
  "figma",
  "kakao",
  "keycloak",
  "notion",
]);

function normalizeProvider(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function readOAuthProviders(appMetadata) {
  if (!appMetadata || typeof appMetadata !== "object") return [];
  const out = [];
  const single = normalizeProvider(appMetadata.provider);
  if (single) out.push(single);
  if (Array.isArray(appMetadata.providers)) {
    for (const p of appMetadata.providers) {
      const n = normalizeProvider(p);
      if (n) out.push(n);
    }
  }
  return out;
}

/**
 * Supabase access tokens use email_confirmed_at / OAuth provider metadata — not email_verified alone.
 * @param {import('jose').JWTPayload} payload
 */
function isEmailVerifiedFromClaims(payload) {
  if (payload.email_verified === true) return true;
  if (payload.email_confirmed_at) return true;

  const providers = readOAuthProviders(payload.app_metadata);
  if (providers.some((p) => OAUTH_EMAIL_VERIFIED_PROVIDERS.has(p))) {
    return true;
  }

  return false;
}

function describeEmailVerificationState(payload) {
  const providers = readOAuthProviders(payload.app_metadata);
  return {
    emailVerifiedClaim: payload.email_verified === true,
    hasEmailConfirmedAt: Boolean(payload.email_confirmed_at),
    providers,
    oauthProviderMatch: providers.some((p) => OAUTH_EMAIL_VERIFIED_PROVIDERS.has(p)),
  };
}

let jwks;
let configLogged = false;

function ensureAuthConfigLogged() {
  if (configLogged) return;
  configLogged = true;
  if (!supabaseAuth.jwksUrl || !supabaseAuth.issuer) {
    logAuthVerifyFailed({ reason: "supabase_url_not_configured" });
    return;
  }
  let jwksHost = null;
  try {
    jwksHost = new URL(supabaseAuth.jwksUrl).host;
  } catch {
    jwksHost = "invalid";
  }
  logAuthConfigReady({
    issuer: supabaseAuth.issuer,
    jwksHost,
  });
}

function getJwks() {
  if (!jwks) {
    if (!supabaseAuth.jwksUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }
    ensureAuthConfigLogged();
    jwks = createRemoteJWKSet(new URL(supabaseAuth.jwksUrl));
  }
  return jwks;
}

function mapVerifyError(err) {
  const code = err?.code;
  if (code === "ERR_JWT_EXPIRED") return "expired";
  if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    const claim = err?.claim;
    if (claim === "iss") return "wrong_issuer";
    if (claim === "aud") return "wrong_audience";
    return "claim_validation_failed";
  }
  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") return "invalid_signature";
  if (code === "ERR_JWS_INVALID" || code === "ERR_JWT_MALFORMED") return "malformed_token";
  return "invalid_token";
}

function extractProfileFromClaims(payload) {
  const meta = payload.user_metadata || {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    null;
  const email =
    (typeof payload.email === "string" && payload.email.trim()) ||
    (typeof meta.email === "string" && meta.email.trim()) ||
    null;

  return { email, fullName, avatarUrl };
}

/**
 * Verify Supabase access token via JWKS (RS256).
 * @returns {Promise<{ sub: string, email: string, fullName: string|null, avatarUrl: string|null, emailVerified: boolean }>}
 */
async function verifySupabaseAccessToken(token, { requestId, path } = {}) {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: supabaseAuth.issuer,
      audience: supabaseAuth.audience,
      clockTolerance: 5,
    });

    const sub = payload.sub;
    if (!sub || typeof sub !== "string") {
      logAuthVerifyFailed({ reason: "missing_sub", requestId, path });
      const err = new Error("Missing subject");
      err.code = "MISSING_SUB";
      throw err;
    }

    const { email, fullName, avatarUrl } = extractProfileFromClaims(payload);
    if (!email) {
      logAuthVerifyFailed({ reason: "missing_email", requestId, path, supabaseUserId: sub });
      const err = new Error("Missing email");
      err.code = "MISSING_EMAIL";
      throw err;
    }

    const verificationState = describeEmailVerificationState(payload);
    const emailVerified = isEmailVerifiedFromClaims(payload);
    if (!emailVerified) {
      logAuthEmailRejected({
        requestId,
        path,
        supabaseUserId: sub,
        ...verificationState,
      });
      const err = new Error("Email not verified");
      err.code = "EMAIL_NOT_VERIFIED";
      throw err;
    }

    return {
      sub,
      email,
      fullName,
      avatarUrl,
      emailVerified,
    };
  } catch (err) {
    if (err.code === "MISSING_SUB" || err.code === "MISSING_EMAIL" || err.code === "EMAIL_NOT_VERIFIED") {
      throw err;
    }
    const reason = mapVerifyError(err);
    logAuthVerifyFailed({
      reason,
      requestId,
      path,
      claim: err?.claim,
    });
    const wrapped = new Error("Unauthorized");
    wrapped.code = "UNAUTHORIZED";
    wrapped.authReason = reason;
    throw wrapped;
  }
}

module.exports = {
  verifySupabaseAccessToken,
  extractProfileFromClaims,
  isEmailVerifiedFromClaims,
  OAUTH_EMAIL_VERIFIED_PROVIDERS,
  /** @internal test hook */
  _resetJwksForTests() {
    jwks = null;
  },
};
