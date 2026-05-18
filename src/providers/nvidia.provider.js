const { REMOTE_PARSE_CAPABILITIES } = require("./capabilities");
const { createOpenAICompatibleProvider } = require("./openaiCompatibleCore");

module.exports = createOpenAICompatibleProvider({
  id: "nvidia",
  providerType: "remote",
  defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
  capabilities: REMOTE_PARSE_CAPABILITIES,
});
