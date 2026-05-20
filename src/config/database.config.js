const { str } = require("./env");
const { isProduction } = require("./server.config");

module.exports = {
  databaseUrl: str("DATABASE_URL", null),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
};
