const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { createOpenAICompatibleProvider } = require("./openaiCompatibleCore");

module.exports = createOpenAICompatibleProvider({
  id: "grok",
  providerType: "remote",
  defaultBaseUrl: "https://api.x.ai/v1",
  capabilities: REMOTE_PARSE_CAPABILITIES,
});
