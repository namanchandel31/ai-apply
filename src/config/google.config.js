const { str, bool } = require("./env");

/**
 * Google OAuth / Gmail API configuration.
 *
 * MVP requests the gmail.send scope ONLY (a Google "sensitive" scope). The
 * gmail.readonly "restricted" scope is never requested unless GMAIL_READ_TIER_ENABLED
 * is on (future reply-tracking / inbox-sync work behind verification + CASA).
 */
const SCOPES = Object.freeze({
  send: "https://www.googleapis.com/auth/gmail.send",
  readonly: "https://www.googleapis.com/auth/gmail.readonly",
  userinfoEmail: "https://www.googleapis.com/auth/userinfo.email",
});

const clientId = str("GOOGLE_CLIENT_ID", null);
const clientSecret = str("GOOGLE_CLIENT_SECRET", null);
const redirectUri = str("GOOGLE_OAUTH_REDIRECT_URI", null);

module.exports = {
  clientId,
  clientSecret,
  redirectUri,
  // Base URL of the SPA used to bounce the user back after the OAuth callback.
  appBaseUrl: str("APP_BASE_URL", null),
  // Feature flag: gate the gmail.readonly tier (UI + scope request). Default off.
  readTierEnabled: bool("GMAIL_READ_TIER_ENABLED", false),
  // Rollout kill switch for Gmail API sending. When false, the delivery service
  // ignores connected Gmail accounts and uses the SMTP app-password path only
  // (unchanged legacy behavior). Default on.
  sendingEnabled: bool("GMAIL_SENDING_ENABLED", true),
  scopes: SCOPES,
  /** True when the three required OAuth credentials are present. */
  isConfigured() {
    return Boolean(clientId && clientSecret && redirectUri);
  },
};
