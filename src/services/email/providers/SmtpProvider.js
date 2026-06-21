const nodemailer = require("nodemailer");
const { createTransportOptions } = require("../../../config/mail.config");
const { EmailProvider } = require("./EmailProvider");

/**
 * SMTP app-password provider. Wraps the nodemailer logic that used to live inline
 * in sendApplication.worker.js, with identical behavior (Gmail SMTP transport).
 *
 * credential: { user, pass } — decrypted app-password credentials.
 */
class SmtpProvider extends EmailProvider {
  get name() {
    return "smtp";
  }

  /** Verifies SMTP credentials (used before saving). Throws on failure. */
  async verifyCredentials({ user, pass }) {
    const transporter = nodemailer.createTransport(createTransportOptions({ user, pass }));
    await transporter.verify();
    return true;
  }

  async sendEmail(credential, message) {
    const transporter = nodemailer.createTransport(
      createTransportOptions({ user: credential.user, pass: credential.pass })
    );

    const result = await transporter.sendMail({
      from: message.from || credential.user,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    });

    return {
      providerMessageId: result.messageId,
      threadId: null,
      raw: result,
    };
  }
}

module.exports = { SmtpProvider };
