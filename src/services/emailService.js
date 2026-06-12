const { z } = require("zod");
const config = require("../config");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { generateStructuredJson } = require("./aiGateway");
const {
  PROMPT_VERSION,
  buildSystemPrompt,
  buildEmailUserPrompt,
  buildRetryUserPrompt,
} = require("../prompts/emailGeneratePrompt");
const { validateGeneratedEmail } = require("./emailValidation");
const { scoreOpeningStrength } = require("./emailOpeningStrength");
const { scoreRecruiterReadability } = require("./emailRecruiterReadability");
const { scoreEmailRealism } = require("./emailRealismScore");
const { scoreDiversityFingerprint } = require("./emailDiversityScore");
const {
  synthesizeEmailCritique,
  buildTargetedRewriteGuidance,
} = require("./emailCritique");
const { sanitizeEmailOutput } = require("../utils/emailSanitize");
const { initialEmailFeedbackSignals } = require("./emailFeedbackService");
const { wordCount } = require("../utils/emailTextUtils");

const RAW_OUTPUT_MAX_CHARS = 5_000;

const emailResponseSchema = z.object({
  subject: z.string().min(5).max(120),
  body: z.string().min(80).max(1600),
});

const RETRY_THRESHOLDS = {
  compositeRisk: 70,
  aiDetectabilityRisk: 75,
  recruiterReadabilityMin: 50,
  openingStrengthMin: 45,
};

function recruiterCompositeScore(scores) {
  const r = scores.recruiterReadability?.overall ?? 0;
  const o = scores.openingStrength?.score ?? 0;
  const ai = scores.realism?.aiDetectabilityRisk ?? 50;
  return r * 0.45 + o * 0.35 + (100 - ai) * 0.2;
}

function shouldTriggerRetry(validation, scores) {
  const fixableHard = (validation.hardFailures || []).filter(
    (f) =>
      !f.startsWith("hallucinated_") && f !== "broken_structure:empty_body"
  );
  if (fixableHard.length > 0) return true;

  if (validation.compositeRisk >= RETRY_THRESHOLDS.compositeRisk) return true;
  if (scores.realism?.aiDetectabilityRisk >= RETRY_THRESHOLDS.aiDetectabilityRisk) {
    return true;
  }
  if (
    (scores.recruiterReadability?.overall ?? 100) <
    RETRY_THRESHOLDS.recruiterReadabilityMin
  ) {
    return true;
  }
  if ((scores.openingStrength?.score ?? 100) < RETRY_THRESHOLDS.openingStrengthMin) {
    return true;
  }
  return false;
}

async function callEmailLlm(userId, userPrompt, logMeta, systemPrompt, options = {}) {
  const gatewayParams = {
    userId,
    task: "email_generate",
    systemPrompt,
    userPrompt,
    promptVersion: PROMPT_VERSION,
    reqId: logMeta.reqId,
    endpoint: options.credentialOverride ? "model_certification" : "email_generate",
    credentialOverride: options.credentialOverride,
    returnExecutionDetails: !!options.credentialOverride,
  };

  const gatewayResult = await generateStructuredJson(gatewayParams);
  const parsed = options.credentialOverride ? gatewayResult.data : gatewayResult;

  const validation = emailResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new NonRetryableError(
      `Schema validation failed: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
    );
  }
  const draft = validation.data;
  if (options.credentialOverride) {
    return { draft, execution: gatewayResult.execution };
  }
  return draft;
}

function evaluateDraft(draft, context) {
  const sanitized = sanitizeEmailOutput(draft);
  const validation = validateGeneratedEmail(sanitized, context);
  const openingStrength = scoreOpeningStrength({
    body: sanitized.body,
    job: context.job,
  });
  const recruiterReadability = scoreRecruiterReadability({
    subject: sanitized.subject,
    body: sanitized.body,
    job: context.job,
  });
  const realism = scoreEmailRealism({
    subject: sanitized.subject,
    body: sanitized.body,
    context,
    validationSignals: validation.validationSignals,
    openingStrength,
    recruiterReadability,
  });
  const diversity = scoreDiversityFingerprint({ body: sanitized.body });

  return {
    draft: sanitized,
    validation,
    scores: {
      openingStrength,
      recruiterReadability,
      realism,
      diversity,
    },
    recruiterComposite: recruiterCompositeScore({
      openingStrength,
      recruiterReadability,
      realism,
    }),
  };
}

function buildEmailMetadata({
  run,
  retryCount,
  history,
  model,
  generationTimeMs,
  context,
}) {
  return {
    schemaVersion: 1,
    latestRun: {
      promptVersion: PROMPT_VERSION,
      model: model || config.ai?.DEFAULT_AI_MODEL || "unknown",
      generationTimeMs,
      retryCount,
      toneType: context.toneType,
      emailToneLevel: context.emailPreferences?.emailToneLevel,
      toneProfile: context.emailPreferences?.toneProfile,
      emailStructureLevel: context.emailPreferences?.emailStructureLevel,
      structureMode: context.emailPreferences?.structureMode,
      selectedPreset: context.emailPreferences?.selectedPreset,
      targetWordRange: context.emailPreferences?.targetWordRange,
      generationSnapshot: context.generationSnapshot || null,
      validationWarnings: run.validation.validationWarnings || [],
      personalizationUsed: context.personalizationUsed || [],
      wordCount: wordCount(run.draft.body),
      validationSignals: run.validation.validationSignals,
      hardFailures: run.validation.hardFailures,
      compositeRisk: run.validation.compositeRisk,
      scores: {
        realism: run.scores.realism,
        recruiterReadability: run.scores.recruiterReadability,
        openingStrength: run.scores.openingStrength,
        diversity: run.scores.diversity,
      },
      recruiterComposite: run.recruiterComposite,
      critiqueSummary: run.critiqueSummary || null,
      rewriteGuidanceApplied: run.rewriteGuidanceApplied || false,
    },
    history: history || [],
  };
}

/**
 * Generate a tailored job application email with weighted quality pipeline.
 * @param {object} context - EmailGenerationContext from buildEmailGenerationContext
 * @param {object} logMeta - { userId, reqId, ... }
 * @returns {Promise<{ subject, body, llmRawOutput, emailMetadata, emailFeedbackSignals }>}
 */
const generateApplicationEmail = async (context, logMeta = {}, options = {}) => {
  const userId = logMeta.userId;
  if (!userId) {
    throw new NonRetryableError("userId is required in logMeta for email generation");
  }
  if (!context?.candidate || !context?.job) {
    throw new NonRetryableError("EmailGenerationContext requires candidate and job");
  }

  const startedAt = Date.now();
  const systemPrompt = buildSystemPrompt(context.emailPreferences?.targetWordRange);
  logInfo("email_generation_start", {
    ...logMeta,
    task: "email_generate",
    promptVersion: PROMPT_VERSION,
    toneProfile: context.emailPreferences?.toneProfile,
    structureMode: context.emailPreferences?.structureMode,
    selectedPreset: context.emailPreferences?.selectedPreset,
    generationSnapshot: context.generationSnapshot,
  });

  const history = [];
  let retryCount = 0;
  let rewriteGuidanceApplied = false;
  let critiqueSummary = null;

  try {
    const userPrompt = buildEmailUserPrompt({
      candidate: context.candidate,
      job: context.job,
      match: context.match,
      toneContext: context.toneContext,
      personalizationContext: context.personalizationContext,
      emailPreferences: context.emailPreferences,
    });

    const llmOptions = {
      credentialOverride: options.credentialOverride,
    };
    const initialLlm = await callEmailLlm(userId, userPrompt, logMeta, systemPrompt, llmOptions);
    let rawDraft = options.credentialOverride ? initialLlm.draft : initialLlm;
    let emailExecution = options.credentialOverride ? initialLlm.execution : null;
    let evaluated = evaluateDraft(rawDraft, context);
    history.push({
      attempt: "initial",
      recruiterComposite: evaluated.recruiterComposite,
      compositeRisk: evaluated.validation.compositeRisk,
    });

    if (!options.certificationMode && shouldTriggerRetry(evaluated.validation, evaluated.scores)) {
      logInfo("email_generation_retry_scheduled", {
        ...logMeta,
        compositeRisk: evaluated.validation.compositeRisk,
        hardFailures: evaluated.validation.hardFailures,
      });

      critiqueSummary = synthesizeEmailCritique({
        hardFailures: evaluated.validation.hardFailures,
        validationSignals: evaluated.validation.validationSignals,
        scores: {
          recruiterReadability: evaluated.scores.recruiterReadability,
          realism: evaluated.scores.realism,
        },
        openingAnalysis: evaluated.scores.openingStrength,
        draft: evaluated.draft,
      });

      const rewriteGuidance = buildTargetedRewriteGuidance(
        critiqueSummary,
        evaluated.draft
      );
      rewriteGuidanceApplied = true;

      const retryPrompt = buildRetryUserPrompt({
        priorDraft: evaluated.draft,
        critique: critiqueSummary,
        rewriteGuidance,
        candidate: context.candidate,
        job: context.job,
      });

      retryCount = 1;
      const retryRaw = await callEmailLlm(userId, retryPrompt, logMeta, systemPrompt);
      const retryEvaluated = evaluateDraft(retryRaw, context);
      history.push({
        attempt: "retry",
        recruiterComposite: retryEvaluated.recruiterComposite,
        compositeRisk: retryEvaluated.validation.compositeRisk,
      });

      if (
        retryEvaluated.recruiterComposite >= evaluated.recruiterComposite ||
        retryEvaluated.validation.compositeRisk < evaluated.validation.compositeRisk
      ) {
        evaluated = retryEvaluated;
      }

      logInfo("email_generation_retry_complete", {
        ...logMeta,
        retryCount,
        selected: evaluated.recruiterComposite,
      });
    }

    evaluated.critiqueSummary = critiqueSummary;
    evaluated.rewriteGuidanceApplied = rewriteGuidanceApplied;

    const generationTimeMs = Date.now() - startedAt;
    const emailMetadata = buildEmailMetadata({
      run: evaluated,
      retryCount,
      history,
      model: config.ai?.DEFAULT_AI_MODEL,
      generationTimeMs,
      context,
    });

    const llmRawOutput = JSON.stringify(evaluated.draft).slice(0, RAW_OUTPUT_MAX_CHARS);

    logInfo("email_generation_success", {
      ...logMeta,
      promptVersion: PROMPT_VERSION,
      retryCount,
      wordCount: emailMetadata.latestRun.wordCount,
      recruiterComposite: evaluated.recruiterComposite,
    });

    const result = {
      subject: evaluated.draft.subject,
      body: evaluated.draft.body,
      llmRawOutput,
      emailMetadata,
      emailFeedbackSignals: initialEmailFeedbackSignals(),
    };
    if (options.credentialOverride) {
      result.execution = emailExecution;
    }
    return result;
  } catch (err) {
    logError("email_generation_failed", err, logMeta);
    throw err;
  }
};

module.exports = {
  generateApplicationEmail,
  buildEmailMetadata,
  RetryableError,
  NonRetryableError,
  PROMPT_VERSION,
};
