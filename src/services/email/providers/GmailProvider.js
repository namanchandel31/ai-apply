const { google } = require("googleapis");
const MailComposer = require("nodemailer/lib/mail-composer");
const config = require("../../../config");
const { EmailProvider } = require("./EmailProvider");

/**
 * Gmail provider — OAuth2 + Gmail API (users.messages.send).
 *
 * Default scope is gmail.send only (Google "sensitive"). gmail.readonly
 * ("restricted") is only ever included when the read tier is explicitly enabled.
 */
function newOAuthClient() {
  const { clientId, clientSecret, redirectUri } = config.google;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawMime(message) {
  return new Promise((resolve, reject) => {
    const composer = new MailComposer({
      from: message.from,
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    });
    composer.compile().build((err, msg) => {
      if (err) return reject(err);
      resolve(toBase64Url(msg));
    });
  });
}

class GmailProvider extends EmailProvider {
  get name() {
    return "gmail";
  }

  get isOAuth() {
    return true;
  }

  /**
   * Builds the Google consent URL.
   * @param {{ scopes: string[], state: string, loginHint?: string }} opts
   */
  getAuthorizationUrl({ scopes, state, loginHint } = {}) {
    const client = newOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline",
      // Force a refresh_token to be issued even on reconnect.
      prompt: "consent",
      include_granted_scopes: true,
      scope: scopes,
      state,
      login_hint: loginHint,
    });
  }

  /**
   * Exchanges an authorization code for tokens + the connected account identity.
   * @returns {{ email, providerAccountId, refreshToken, accessToken, expiresAt, grantedScopes }}
   */
  async exchangeCode(code) {
    const client = newOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();

    const grantedScopes = typeof tokens.scope === "string" ? tokens.scope.split(" ").filter(Boolean) : [];

    return {
      email: data.email,
      providerAccountId: data.id || null,
      refreshToken: tokens.refresh_token || null,
      accessToken: tokens.access_token || null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      grantedScopes,
    };
  }

  /**
   * Refreshes an access token from a refresh token.
   * @returns {{ accessToken, expiresAt, refreshToken: string|null }}
   */
  async refreshAccessToken(refreshToken) {
    const client = newOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      // Google rarely rotates refresh tokens; surface it if present.
      refreshToken: credentials.refresh_token || null,
    };
  }

  async revoke(token) {
    if (!token) return;
    const client = newOAuthClient();
    await client.revokeToken(token);
  }

  /**
   * Sends a message via the Gmail API.
   * @param {{ accessToken: string, emailAddress?: string }} credential
   * @param {{ from, to, subject, text, html?, attachments?, threadId? }} message
   * @returns {{ providerMessageId, threadId, raw }}
   */
  async sendEmail(credential, message) {
    const client = newOAuthClient();
    client.setCredentials({ access_token: credential.accessToken });
    const gmail = google.gmail({ version: "v1", auth: client });

    const raw = await buildRawMime({
      ...message,
      from: message.from || credential.emailAddress,
    });

    const requestBody = { raw };
    if (message.threadId) requestBody.threadId = message.threadId;

    const res = await gmail.users.messages.send({ userId: "me", requestBody });

    return {
      providerMessageId: res.data.id,
      threadId: res.data.threadId || null,
      raw: res.data,
    };
  }
}

module.exports = { GmailProvider, buildRawMime };
