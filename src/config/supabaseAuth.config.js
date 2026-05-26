const { str } = require("./env");

const url = str("SUPABASE_URL", null);
const normalizedUrl = url ? url.replace(/\/$/, "") : null;

module.exports = {
  url: normalizedUrl,
  issuer: normalizedUrl ? `${normalizedUrl}/auth/v1` : null,
  jwksUrl: normalizedUrl ? `${normalizedUrl}/auth/v1/.well-known/jwks.json` : null,
  audience: "authenticated",
};
