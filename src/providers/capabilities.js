/**
 * Provider capability flags for gateway routing and future agent orchestration.
 */

const DEFAULT_CAPABILITIES = {
  supportsStructuredJson: false,
  supportsText: false,
  supportsToolCalling: false, // TODO: agent orchestration — multi-step tool loops
  supportsFunctionCalling: false, // TODO: structured function dispatch
  supportsReasoning: false, // TODO: reasoning models (o-series, Claude thinking)
  supportsEmbeddings: false, // TODO: resume/JD semantic search, RAG
  supportsLongContext: false, // TODO: large JD / resume payloads
  supportsStreaming: false, // TODO: streaming UI + partial responses
  supportsVision: false, // TODO: PDF/image resume parsing
};

const REMOTE_PARSE_CAPABILITIES = {
  ...DEFAULT_CAPABILITIES,
  supportsStructuredJson: true,
  supportsText: true,
  supportsLongContext: true,
};

const LOCAL_STUB_CAPABILITIES = {
  ...DEFAULT_CAPABILITIES,
  supportsStructuredJson: true,
  supportsText: true,
};

function mergeCapabilities(overrides = {}) {
  return { ...DEFAULT_CAPABILITIES, ...overrides };
}

module.exports = {
  DEFAULT_CAPABILITIES,
  REMOTE_PARSE_CAPABILITIES,
  LOCAL_STUB_CAPABILITIES,
  mergeCapabilities,
};
