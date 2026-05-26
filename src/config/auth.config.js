const { str } = require("./env");

module.exports = {
  internalApiKey: str("INTERNAL_API_KEY", null),
  encryptionKey: str("ENCRYPTION_KEY", null),
};
