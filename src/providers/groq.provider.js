const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { createOpenAICompatibleProvider } = require("./openaiCompatibleCore");

module.exports = createOpenAICompatibleProvider({
  id: "groq",
  providerType: "remote",
  defaultBaseUrl: "https://api.groq.com/openai/v1",
  capabilities: REMOTE_PARSE_CAPABILITIES,
});
