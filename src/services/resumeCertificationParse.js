const { generateStructuredJson } = require("./aiGateway");
const { RESUME_SYSTEM_PROMPT } = require("../prompts/resumeParsePrompt");
const { ResumeSchema } = require("../schemas/resumeSchema");
const { scoreResumeParse } = require("./resumeCertificationScorer");
const { NonRetryableError } = require("../utils/errors");

const PROMPT_VERSION = "resume_parse_v1";

async function parseResumeForCertification({
  userId,
  cleanedText,
  credentialOverride,
  reqId,
}) {
  const userPrompt = `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}`;

  const gatewayResult = await generateStructuredJson({
    userId,
    task: "resume_parse",
    systemPrompt: RESUME_SYSTEM_PROMPT,
    userPrompt,
    promptVersion: PROMPT_VERSION,
    reqId,
    endpoint: "model_certification",
    credentialOverride,
    returnExecutionDetails: true,
  });

  const parsed = gatewayResult.data;
  const schemaResult = ResumeSchema.safeParse(parsed);
  if (!schemaResult.success) {
    throw new NonRetryableError(
      `Schema validation failed: ${JSON.stringify(schemaResult.error.flatten().fieldErrors)}`
    );
  }

  const scored = scoreResumeParse(schemaResult.data, cleanedText);
  if (!scored.schemaOk) {
    throw new NonRetryableError("Resume schema validation failed");
  }

  return {
    parsed: schemaResult.data,
    resumeScore: scored.resumeScore,
    groundingDetail: scored.groundingDetail,
    execution: gatewayResult.execution,
  };
}

module.exports = { parseResumeForCertification };
