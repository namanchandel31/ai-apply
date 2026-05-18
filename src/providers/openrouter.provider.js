const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { createOpenAICompatibleProvider } = require("./openaiCompatibleCore");

module.exports = createOpenAICompatibleProvider({
  id: "openrouter",
  providerType: "remote",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  capabilities: REMOTE_PARSE_CAPABILITIES,
});
