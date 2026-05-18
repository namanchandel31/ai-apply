const { z } = require("zod");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { logInfo, logError } = require("../utils/logger");
const { generateStructuredJson } = require("./aiGateway");

const PROMPT_VERSION = "email_generate_v1";
const RAW_OUTPUT_MAX_CHARS = 5_000;

const emailResponseSchema = z.object({
  subject: z.string().min(5).max(120),
  body: z.string().min(1).max(1500),
});

const SYSTEM_PROMPT = `You are an expert career coach writing a job application email.

Rules (follow strictly):
1. Write in a professional, direct tone.
2. No generic fluff like "I am excited to apply" or "I came across your job posting".
3. No storytelling. Get straight to the point.
4. Keep the body strictly between 8 to 12 lines.
5. Make it sound human, not robotic.
6. Output ONLY valid JSON matching the exact schema — no markdown, no explanation.

Schema:
{
  "subject": "string (5-120 chars)",
  "body": "string (1-1500 chars)"
}`;

/**
 * Generate a tailored job application email via aiGateway.
 * @returns {Promise<{ subject: string, body: string, llmRawOutput: string }>}
 */
const generateApplicationEmail = async (
  candidateName,
  jobTitle,
  matchedSkills,
  matchScore,
  logMeta = {}
) => {
  const userId = logMeta.userId;
  if (!userId) {
    throw new NonRetryableError("userId is required in logMeta for email generation");
  }

  let skillFocus;
  if (matchScore === 0 || !matchedSkills?.length) {
    skillFocus =
      "Do NOT list specific skills. Focus entirely on adaptability, eagerness to learn, and general professional experience.";
  } else {
    skillFocus = `Explicitly mention how these specific skills make the candidate a fit: ${matchedSkills.join(", ")}. Do NOT mention any missing skills.`;
  }

  const userPrompt =
    `Candidate Name: ${candidateName || "A professional candidate"}\n` +
    `Job Title: ${jobTitle || "the open role"}\n\n` +
    `Skill focus: ${skillFocus}`;

  logInfo("email_generation_start", { ...logMeta, task: "email_generate" });

  try {
    const parsed = await generateStructuredJson({
      userId,
      task: "email_generate",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      promptVersion: PROMPT_VERSION,
      reqId: logMeta.reqId,
      endpoint: "email_generate",
    });

    const validation = emailResponseSchema.safeParse(parsed);
    if (!validation.success) {
      throw new NonRetryableError(
        `Schema validation failed: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
      );
    }

    const llmRawOutput = JSON.stringify(validation.data).slice(0, RAW_OUTPUT_MAX_CHARS);
    logInfo("email_generation_success", { ...logMeta, promptVersion: PROMPT_VERSION });

    return {
      subject: validation.data.subject,
      body: validation.data.body,
      llmRawOutput,
    };
  } catch (err) {
    logError("email_generation_failed", err, logMeta);
    throw err;
  }
};

module.exports = { generateApplicationEmail, RetryableError, NonRetryableError };
