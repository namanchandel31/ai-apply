/**
 * Transport-agnostic email provider interface.
 *
 * Implementations (GmailProvider, SmtpProvider, future Outlook/M365) keep all
 * provider-specific logic behind this contract so application code (the send
 * worker, MailDeliveryService) never branches on transport.
 *
 * A `message` is: { from, to, subject, text, html?, attachments? }
 * where attachments is [{ filename, content: Buffer, contentType }].
 *
 * A send result is: { providerMessageId, threadId, raw }.
 */
class EmailProvider {
  /** Stable provider key, e.g. "gmail" | "smtp". */
  get name() {
    throw new Error("EmailProvider.name not implemented");
  }

  /** True for OAuth-based providers (need token lifecycle handling). */
  get isOAuth() {
    return false;
  }

  // ----- OAuth lifecycle (OAuth providers only) -----

  // eslint-disable-next-line no-unused-vars
  getAuthorizationUrl(_opts) {
    throw new Error(`${this.name}: getAuthorizationUrl not supported`);
  }

  // eslint-disable-next-line no-unused-vars
  async exchangeCode(_code) {
    throw new Error(`${this.name}: exchangeCode not supported`);
  }

  // eslint-disable-next-line no-unused-vars
  async refreshAccessToken(_refreshToken) {
    throw new Error(`${this.name}: refreshAccessToken not supported`);
  }

  // eslint-disable-next-line no-unused-vars
  async revoke(_token) {
    throw new Error(`${this.name}: revoke not supported`);
  }

  // ----- Sending (all providers) -----

  // eslint-disable-next-line no-unused-vars
  async sendEmail(_credential, _message) {
    throw new Error(`${this.name}: sendEmail not implemented`);
  }
}

module.exports = { EmailProvider };
