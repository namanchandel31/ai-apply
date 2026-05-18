const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { createOpenAICompatibleProvider } = require("./openaiCompatibleCore");

module.exports = createOpenAICompatibleProvider({
  id: "openai",
  providerType: "remote",
  capabilities: REMOTE_PARSE_CAPABILITIES,
});
