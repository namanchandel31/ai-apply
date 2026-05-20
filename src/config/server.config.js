const { str, int, bool } = require("./env");

const nodeEnv = str("NODE_ENV", "development");
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";
const isDevelopment = !isProduction && !isTest;

module.exports = {
  nodeEnv,
  isProduction,
  isTest,
  isDevelopment,
  port: int("PORT", 5000),
  testMode: bool("TEST_MODE", false),
  forceLlmError: bool("FORCE_LLM_ERROR", false),
};
