const { str } = require("./env");

module.exports = {
  jwtSecret: str("JWT_SECRET", null),
  internalApiKey: str("INTERNAL_API_KEY", null),
  encryptionKey: str("ENCRYPTION_KEY", null),
};
