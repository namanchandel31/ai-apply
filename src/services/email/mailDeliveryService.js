const config = require("../../config");
const emailAccountModel = require("../../models/emailAccountModel");
const oauthTokenService = require("../oauthTokenService");
const { getProvider } = require("./providerRegistry");
const { fetchSmtpCredentials } = require("../mailService");
const { logInfo } = require("../../utils/logger");

/**
 * Resolves which connected account a user's mail should be sent from.
 * Preference: a connected Gmail OAuth account that can send; otherwise the legacy
 * SMTP app-password credentials. Throws NO_CREDENTIALS when neither exists.
 *
 * @returns {Promise<{type:'gmail', account}|{type:'smtp', credentials}>}
 */
async function resolveSendingAccount(userId) {
  // Rollout kill switch: when Gmail sending is disabled, behave exactly like the
  // legacy SMTP-only path regardless of any connected Gmail account.
  if (config.google.sendingEnabled) {
    const gmail = await emailAccountModel.getByUserAndProvider(userId, "gmail");
    if (gmail && gmail.status === "connected" && gmail.can_send) {
      return { type: "gmail", account: gmail };
    }
  }
  // Falls through to SMTP. fetchSmtpCredentials throws NO_CREDENTIALS if absent.
  const credentials = await fetchSmtpCredentials(userId);
  return { type: "smtp", credentials };
}

/**
 * Sends a message via the user's resolved provider. Transport-agnostic — the only
 * place provider branching lives. Returns a normalized send result.
 *
 * @param {string} userId
 * @param {{ to, subject, text, html?, attachments?, threadId? }} message
 * @returns {Promise<{ provider, fromEmail, providerMessageId, threadId, accountId? }>}
 */
async function send(userId, message, logMeta = {}) {
  const resolved = await resolveSendingAccount(userId);

  if (resolved.type === "gmail") {
    const { account } = resolved;
    const { accessToken } = await oauthTokenService.getFreshAccessToken(account);
    const provider = getProvider("gmail");
    try {
      const result = await provider.sendEmail(
        { accessToken, emailAddress: account.email_address },
        { ...message, from: account.email_address }
      );
      // last_used_at + health reset to healthy on every successful send.
      await emailAccountModel.touchLastUsed(account.id);
      logInfo("MAIL_DELIVERY_SENT", {
        ...logMeta,
        provider: "gmail",
        messageId: result.providerMessageId,
        threadId: result.threadId,
      });
      return {
        provider: "gmail",
        fromEmail: account.email_address,
        providerMessageId: result.providerMessageId,
        threadId: result.threadId,
        accountId: account.id,
      };
    } catch (err) {
      // Degrade operational health; do not touch connection status here (token
      // service owns revocation). Worker decides retry/terminal.
      await emailAccountModel.markHealth(account.id, "degraded", err.message).catch(() => {});
      err.emailAccountId = account.id;
      throw err;
    }
  }

  // SMTP app-password fallback (existing behavior).
  const provider = getProvider("smtp");
  const result = await provider.sendEmail(
    { user: resolved.credentials.email, pass: resolved.credentials.password },
    { ...message, from: resolved.credentials.email }
  );
  logInfo("MAIL_DELIVERY_SENT", {
    ...logMeta,
    provider: "smtp",
    messageId: result.providerMessageId,
  });
  return {
    provider: "smtp",
    fromEmail: resolved.credentials.email,
    providerMessageId: result.providerMessageId,
    threadId: null,
  };
}

module.exports = { resolveSendingAccount, send };
