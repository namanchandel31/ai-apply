/**
 * @deprecated Use aiGateway directly. Thin compatibility wrapper during migration.
 */
const { generateStructuredJson } = require("./aiGateway");
const { LLM_MODEL } = require("../config/parsingConfig");

const PROMPT_VERSION_RESUME = "resume_parse_v1";
const PROMPT_VERSION_JD = "jd_parse_v1";

const callOpenAIJson = async ({
  systemPrompt,
  userPrompt,
  reqId = "UNKNOWN",
  jobId = "UNKNOWN",
  source = "unknown",
  attempt = 1,
  signal,
  userId,
}) => {
  if (!userId) {
    throw new Error("callOpenAIJson: userId is required — route all LLM calls through aiGateway with BYOK context");
  }

  const task = source === "jd" ? "jd_parse" : "resume_parse";
  const promptVersion = source === "jd" ? PROMPT_VERSION_JD : PROMPT_VERSION_RESUME;

  return generateStructuredJson({
    userId,
    task,
    systemPrompt,
    userPrompt,
    promptVersion,
    reqId,
    jobId,
    endpoint: task,
    signal,
  });
};

module.exports = {
  callOpenAIJson,
  LLM_MODEL,
};
