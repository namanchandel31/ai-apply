const { createRemoteJWKSet, decodeJwt, jwtVerify } = require("jose");
const { supabaseAuth } = require("../config");
const { bool } = require("../config/env");
const {
  logAuthVerifyFailed,
  logAuthEmailRejected,
  logAuthConfigReady,
  logAuthVerifyDebug,
} = require("./authObservability");

const AUTH_DEBUG = bool("AUTH_DEBUG", false);

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

function isAuthDebugEnabled() {
  return AUTH_DEBUG;
}

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

function hasOAuthAuthenticationMethod(payload) {
  const amr = payload?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (typeof entry === "string") {
      const m = entry.toLowerCase();
      return m === "oauth" || m.startsWith("oauth/");
    }
    if (entry && typeof entry === "object" && typeof entry.method === "string") {
      const m = entry.method.toLowerCase();
      return m === "oauth" || m.startsWith("oauth/") || m === "sso/saml";
    }
    return false;
  });
}

/**
 * Supabase access tokens often omit email_verified / email_confirmed_at; use amr + app_metadata.
 * @param {import('jose').JWTPayload} payload
 */
function isEmailVerifiedFromClaims(payload) {
  if (payload.email_verified === true) return true;
  if (payload.email_confirmed_at) return true;
  if (payload.confirmed_at) return true;

  const userMeta = payload.user_metadata;
  if (userMeta && typeof userMeta === "object" && userMeta.email_verified === true) {
    return true;
  }

  const providers = readOAuthProviders(payload.app_metadata);
  if (providers.some((p) => OAUTH_EMAIL_VERIFIED_PROVIDERS.has(p))) {
    return true;
  }

  if (hasOAuthAuthenticationMethod(payload)) {
    return true;
  }

  return false;
}

function describeEmailVerificationState(payload) {
  const providers = readOAuthProviders(payload.app_metadata);
  return {
    emailVerifiedClaim: payload.email_verified === true,
    hasEmailConfirmedAt: Boolean(payload.email_confirmed_at || payload.confirmed_at),
    userMetadataEmailVerified: Boolean(payload.user_metadata?.email_verified),
    providers,
    oauthProviderMatch: providers.some((p) => OAUTH_EMAIL_VERIFIED_PROVIDERS.has(p)),
    oauthAmr: hasOAuthAuthenticationMethod(payload),
  };
}

function payloadDebugSnapshot(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    sub: payload.sub,
    iss: payload.iss,
    aud: payload.aud,
    role: payload.role,
    emailPresent: Boolean(payload.email),
    email_verified: payload.email_verified,
    email_confirmed_at: payload.email_confirmed_at ? true : undefined,
    confirmed_at: payload.confirmed_at ? true : undefined,
    provider: payload.app_metadata?.provider,
    providers: payload.app_metadata?.providers,
    amr: payload.amr,
    user_metadata_email_verified: payload.user_metadata?.email_verified,
    exp: payload.exp,
  };
}

function audienceMatches(payload, expectedAudience) {
  const aud = payload?.aud;
  if (aud == null) return false;
  if (typeof aud === "string") return aud === expectedAudience;
  if (Array.isArray(aud)) return aud.includes(expectedAudience);
  return false;
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
    audience: supabaseAuth.audience,
  });
}

function getJwks() {
  if (!jwks) {
    if (!supabaseAuth.jwksUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }
    ensureAuthConfigLogged();
    jwks = createRemoteJWKSet(new URL(supabaseAuth.jwksUrl), {
      cooldownDuration: 60_000,
    });
  }
  return jwks;
}

function mapVerifyError(err) {
  const code = err?.code;
  const message = err?.message || "";

  if (code === "ERR_JWT_EXPIRED") return "expired";
  if (code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    const claim = err?.claim;
    if (claim === "iss") return "wrong_issuer";
    if (claim === "aud") return "wrong_audience";
    return "claim_validation_failed";
  }
  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") return "invalid_signature";
  if (code === "ERR_JWS_INVALID" || code === "ERR_JWT_MALFORMED") return "malformed_token";
  if (code === "ERR_JWKS_NO_MATCHING_KEY") return "jwks_no_matching_key";
  if (code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS") return "jwks_multiple_matching_keys";
  if (code === "ERR_JWKS_TIMEOUT") return "jwks_fetch_failed";

  if (/fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return "jwks_fetch_failed";
  }

  return "invalid_token";
}

function authReasonToResponseCode(reason) {
  const map = {
    expired: "TOKEN_EXPIRED",
    wrong_issuer: "INVALID_ISSUER",
    wrong_audience: "INVALID_AUDIENCE",
    invalid_signature: "INVALID_TOKEN",
    malformed_token: "INVALID_TOKEN",
    jwks_fetch_failed: "JWKS_FETCH_FAILED",
    jwks_no_matching_key: "INVALID_TOKEN",
    jwks_multiple_matching_keys: "INVALID_TOKEN",
    claim_validation_failed: "INVALID_TOKEN",
    invalid_token: "INVALID_TOKEN",
  };
  return map[reason] || "UNAUTHORIZED";
}

function buildVerifyError(reason, { requestId, path, claim, payloadSnapshot } = {}) {
  logAuthVerifyFailed({ reason, requestId, path, claim });
  if (isAuthDebugEnabled() && payloadSnapshot) {
    logAuthVerifyDebug({
      requestId,
      path,
      rejectionReason: reason,
      payload: payloadSnapshot,
      expectedIssuer: supabaseAuth.issuer,
      expectedAudience: supabaseAuth.audience,
    });
  }
  const err = new Error("Unauthorized");
  err.code = authReasonToResponseCode(reason);
  err.authReason = reason;
  return err;
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

function decodeTokenPayload(token) {
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}

/**
 * Verify Supabase access token via JWKS (RS256 / ES256 per project JWKS).
 */
async function verifySupabaseAccessToken(token, { requestId, path } = {}) {
  const unverified = decodeTokenPayload(token);
  const unverifiedSnapshot = payloadDebugSnapshot(unverified);

  if (isAuthDebugEnabled()) {
    logAuthVerifyDebug({
      requestId,
      path,
      phase: "pre_verify",
      authHeaderPresent: true,
      tokenPresent: Boolean(token),
      payload: unverifiedSnapshot,
      expectedIssuer: supabaseAuth.issuer,
      expectedAudience: supabaseAuth.audience,
    });
  }

  let payload;
  try {
    const result = await jwtVerify(token, getJwks(), {
      issuer: supabaseAuth.issuer,
      audience: supabaseAuth.audience,
      clockTolerance: 30,
    });
    payload = result.payload;
  } catch (verifyErr) {
    if (
      verifyErr?.code === "ERR_JWT_CLAIM_VALIDATION_FAILED" &&
      verifyErr?.claim === "aud" &&
      unverified &&
      audienceMatches(unverified, supabaseAuth.audience)
    ) {
      try {
        const retry = await jwtVerify(token, getJwks(), {
          issuer: supabaseAuth.issuer,
          clockTolerance: 30,
        });
        payload = retry.payload;
        if (!audienceMatches(payload, supabaseAuth.audience)) {
          throw buildVerifyError("wrong_audience", {
            requestId,
            path,
            claim: "aud",
            payloadSnapshot: payloadDebugSnapshot(payload),
          });
        }
      } catch (retryErr) {
        if (retryErr.authReason) throw retryErr;
        const reason = mapVerifyError(retryErr);
        throw buildVerifyError(reason, {
          requestId,
          path,
          claim: retryErr?.claim,
          payloadSnapshot: unverifiedSnapshot,
        });
      }
    } else {
      const reason = mapVerifyError(verifyErr);
      throw buildVerifyError(reason, {
        requestId,
        path,
        claim: verifyErr?.claim,
        payloadSnapshot: unverifiedSnapshot,
      });
    }
  }

  const verifiedSnapshot = payloadDebugSnapshot(payload);

  const sub = payload.sub;
  if (!sub || typeof sub !== "string") {
    logAuthVerifyFailed({ reason: "missing_sub", requestId, path });
    const err = new Error("Missing subject");
    err.code = "MISSING_SUB";
    throw err;
  }

  if (!audienceMatches(payload, supabaseAuth.audience)) {
    throw buildVerifyError("wrong_audience", {
      requestId,
      path,
      claim: "aud",
      payloadSnapshot: verifiedSnapshot,
    });
  }

  const { email, fullName, avatarUrl } = extractProfileFromClaims(payload);
  if (!email) {
    logAuthVerifyFailed({ reason: "missing_email", requestId, path, supabaseUserId: sub });
    const err = new Error("Missing email in token");
    err.code = "MISSING_EMAIL";
    if (isAuthDebugEnabled()) {
      logAuthVerifyDebug({
        requestId,
        path,
        rejectionReason: "missing_email",
        payload: verifiedSnapshot,
      });
    }
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
    if (isAuthDebugEnabled()) {
      logAuthVerifyDebug({
        requestId,
        path,
        rejectionReason: "email_not_verified",
        payload: verifiedSnapshot,
        ...verificationState,
      });
    }
    const err = new Error("Email not verified");
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }

  if (isAuthDebugEnabled()) {
    logAuthVerifyDebug({
      requestId,
      path,
      phase: "verified",
      payload: verifiedSnapshot,
      ...verificationState,
    });
  }

  return {
    sub,
    email,
    fullName,
    avatarUrl,
    emailVerified,
  };
}

module.exports = {
  verifySupabaseAccessToken,
  extractProfileFromClaims,
  isEmailVerifiedFromClaims,
  hasOAuthAuthenticationMethod,
  audienceMatches,
  authReasonToResponseCode,
  payloadDebugSnapshot,
  OAUTH_EMAIL_VERIFIED_PROVIDERS,
  isAuthDebugEnabled,
  /** @internal test hook */
  _resetJwksForTests() {
    jwks = null;
    configLogged = false;
  },
};
