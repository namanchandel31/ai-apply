const { str } = require("./env");

const url = str("SUPABASE_URL", null);
const normalizedUrl = url ? url.replace(/\/$/, "") : null;

/** Optional override when issuer in tokens differs from default (rare). */
const issuerOverride = str("SUPABASE_JWT_ISSUER", null);
const audience = str("SUPABASE_JWT_AUDIENCE", "authenticated");

module.exports = {
  url: normalizedUrl,
  issuer: issuerOverride || (normalizedUrl ? `${normalizedUrl}/auth/v1` : null),
  jwksUrl: normalizedUrl ? `${normalizedUrl}/auth/v1/.well-known/jwks.json` : null,
  audience,
};
