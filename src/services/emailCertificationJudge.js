const { z } = require("zod");
const config = require("../config");
const { generateStructuredJson } = require("./aiGateway");
const { resolvePlatformCredentials } = require("./aiCredentialService");
const {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserPrompt,
} = require("../prompts/emailCertificationJudgePrompt");
const { NonRetryableError } = require("../utils/errors");

const judgeSchema = z.object({
  emailScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
});

function buildCandidateSummary(parsedResume) {
  const skills = (parsedResume.skills || []).slice(0, 15).join(", ");
  const exp = (parsedResume.experience || [])
    .slice(0, 2)
    .map((e) => `${e.role || "?"} at ${e.company || "?"}`)
    .join("; ");
  return `Name: ${parsedResume.name || "unknown"}
Email: ${parsedResume.email || "unknown"}
Skills: ${skills || "none"}
Experience: ${exp || "none"}
Summary: ${(parsedResume.summary || "").slice(0, 300)}`;
}

function buildJobSummary(parsedJd) {
  return `Title: ${parsedJd.job_title || "unknown"}
Company: ${parsedJd.company_name || "unknown"}
Location: ${parsedJd.location || "unknown"}
Required skills: ${(parsedJd.skills || []).join(", ")}`;
}

async function resolveJudgeCredentialOverride(fallbackOverride) {
  const platform = await resolvePlatformCredentials("email_generate");
  if (platform?.apiKey) {
    return {
      provider: platform.provider,
      apiKey: platform.apiKey,
      model: platform.model || config.ai.DEFAULT_AI_MODEL,
      providerType: "remote",
    };
  }
  return fallbackOverride;
}

async function judgeCertificationEmail({
  userId,
  subject,
  body,
  parsedResume,
  parsedJd,
  credentialOverride,
  reqId,
}) {
  const userPrompt = buildJudgeUserPrompt({
    subject,
    body,
    candidateSummary: buildCandidateSummary(parsedResume),
    jobSummary: buildJobSummary(parsedJd),
  });

  const judgeOverride = await resolveJudgeCredentialOverride(credentialOverride);

  const gatewayResult = await generateStructuredJson({
    userId,
    task: "resume_parse",
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt,
    promptVersion: "email_cert_judge_v1",
    reqId,
    endpoint: "model_certification_judge",
    credentialOverride: judgeOverride,
    returnExecutionDetails: true,
  });

  const validated = judgeSchema.safeParse(gatewayResult.data);
  if (!validated.success) {
    throw new NonRetryableError("Judge returned invalid score format");
  }

  return {
    emailScore: Math.round(validated.data.emailScore),
    confidence: Math.round(validated.data.confidence),
    execution: gatewayResult.execution,
  };
}

module.exports = { judgeCertificationEmail };
