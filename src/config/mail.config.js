/**
 * Outbound mail: Gmail app-password only (user creds in DB).
 * Not configurable via env until multi-provider ships.
 */
const GMAIL_TRANSPORT = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
};

function createTransportOptions(auth) {
  return {
    ...GMAIL_TRANSPORT,
    auth,
  };
}

module.exports = {
  provider: "gmail",
  GMAIL_TRANSPORT,
  createTransportOptions,
};
