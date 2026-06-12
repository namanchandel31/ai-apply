const { buildEmailGenerationContext } = require("./emailContextBuilder");
const { generateApplicationEmail } = require("./emailService");
const { computeMatch } = require("./matchingService");
const { getEmailPreferenceLevels } = require("../models/userModel");
const {
  CERTIFICATION_SAMPLE_JD_TEXT,
  CERTIFICATION_PARSED_JD,
} = require("../constants/certificationSampleJd");
const { parseResumeForCertification } = require("./resumeCertificationParse");
const { judgeCertificationEmail } = require("./emailCertificationJudge");
const { computeAttemptCertificationScore } = require("./certificationScoring");
const { logCertificationDebug } = require("./certificationDebug");
const { NonRetryableError } = require("../utils/errors");

function sumExecutionCost(...executions) {
  return executions.reduce((sum, ex) => sum + (ex?.estimatedCost || 0), 0);
}

function buildCredentialOverride({ provider, model, apiKey }) {
  return {
    provider,
    model,
    apiKey,
    providerType: "remote",
  };
}

function buildAttemptError(step, message, attempt) {
  return { step, message: message || "Unknown error", attempt };
}

function formatAttemptError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return `${error.step}: ${error.message}`;
}

async function executeCertificationAttempt({
  userId,
  cleanedText,
  provider,
  model,
  apiKey,
  reqId,
  attempt,
}) {
  const startedAt = Date.now();
  const credentialOverride = buildCredentialOverride({ provider, model, apiKey });
  const metadata = { resumeParse: null, emailGenerate: null, emailJudge: null };
  let currentStep = "resume_parse";

  try {
    logCertificationDebug("attempt_start", {
      attempt,
      resolvedResumeLength: cleanedText?.length ?? 0,
    });

    const parseResult = await parseResumeForCertification({
      userId,
      cleanedText,
      credentialOverride,
      reqId: `${reqId}-a${attempt}`,
    });
    metadata.resumeParse = parseResult.execution;
    logCertificationDebug("resume_parse_complete", {
      attempt,
      resumeScore: parseResult.resumeScore,
    });

    currentStep = "email_generation";
    const prefLevels = (await getEmailPreferenceLevels(userId)) || {
      emailToneLevel: 50,
      emailStructureLevel: 60,
    };
    const matchResult = computeMatch(parseResult.parsed, CERTIFICATION_PARSED_JD);

    const emailContext = buildEmailGenerationContext({
      rawJdText: CERTIFICATION_SAMPLE_JD_TEXT,
      parsedJd: CERTIFICATION_PARSED_JD,
      resumeParsedJson: parseResult.parsed,
      matchResult,
      emailToneLevel: prefLevels.emailToneLevel,
      emailStructureLevel: prefLevels.emailStructureLevel,
    });

    const emailResult = await generateApplicationEmail(
      emailContext,
      { userId, reqId: `${reqId}-a${attempt}-email` },
      { credentialOverride, certificationMode: true }
    );

    if (!emailResult?.body?.trim()) {
      throw new NonRetryableError("Model returned empty email body");
    }

    metadata.emailGenerate = emailResult.execution;
    logCertificationDebug("email_generation_complete", {
      attempt,
      emailGenerated: true,
    });

    currentStep = "judge_scoring";
    const judgeResult = await judgeCertificationEmail({
      userId,
      subject: emailResult.subject,
      body: emailResult.body,
      parsedResume: parseResult.parsed,
      parsedJd: CERTIFICATION_PARSED_JD,
      credentialOverride,
      reqId: `${reqId}-a${attempt}-judge`,
    });
    metadata.emailJudge = judgeResult.execution;
    logCertificationDebug("judge_scoring_complete", {
      attempt,
      emailScore: judgeResult.emailScore,
      judgeConfidence: judgeResult.confidence,
    });

    const certificationScore = computeAttemptCertificationScore(
      parseResult.resumeScore,
      judgeResult.emailScore
    );

    const costUsd = sumExecutionCost(
      parseResult.execution,
      emailResult.execution,
      judgeResult.execution
    );

    logCertificationDebug("attempt_complete", {
      attempt,
      certificationScore,
      success: true,
    });

    return {
      success: true,
      resumeScore: parseResult.resumeScore,
      emailScore: judgeResult.emailScore,
      certificationScore,
      confidence: judgeResult.confidence,
      costUsd,
      latencyMs: Date.now() - startedAt,
      groundingDetail: parseResult.groundingDetail,
      subjectPreview: String(emailResult.subject || "").slice(0, 200),
      bodyPreview: String(emailResult.body || "").slice(0, 500),
      providerMetadata: metadata,
    };
  } catch (err) {
    const structuredError = buildAttemptError(
      currentStep,
      err?.message || String(err),
      attempt
    );
    logCertificationDebug("attempt_failed", {
      attempt,
      step: structuredError.step,
      message: structuredError.message,
    });

    return {
      success: false,
      error: structuredError,
      costUsd: sumExecutionCost(metadata.resumeParse, metadata.emailGenerate, metadata.emailJudge),
      latencyMs: Date.now() - startedAt,
      providerMetadata: metadata,
    };
  }
}

module.exports = {
  executeCertificationAttempt,
  buildCredentialOverride,
  buildAttemptError,
  formatAttemptError,
};
