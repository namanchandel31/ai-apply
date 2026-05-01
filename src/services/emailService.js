const OpenAI = require("openai");
const { z } = require("zod");
const { logError, logInfo } = require("../utils/logger");

const openai = new OpenAI();

// Zod schema enforcing the exact email output constraints
const emailResponseSchema = z.object({
  subject: z.string().min(5).max(120),
  body: z.string().min(1).max(1500)
});

class NonRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonRetryableError";
  }
}

class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Generate a highly tailored application email using OpenAI.
 * 
 * @param {string} candidateName 
 * @param {string} jobTitle 
 * @param {string[]} matchedSkills 
 * @param {number} matchScore
 * @param {Object} logMeta 
 * @returns {Promise<{subject: string, body: string}>}
 */
const generateApplicationEmail = async (candidateName, jobTitle, matchedSkills, matchScore, logMeta) => {
  try {
    let skillFocus = "";
    if (matchScore === 0 || matchedSkills.length === 0) {
      skillFocus = "Do NOT list specific skills. Focus entirely on adaptability, eagerness to learn, and general professional experience.";
    } else {
      skillFocus = `Explicitly mention how these specific skills make the candidate a fit: ${matchedSkills.join(", ")}. Do NOT mention any missing skills.`;
    }

    const prompt = `
You are an expert career coach writing a job application email.
Candidate Name: ${candidateName || "A professional candidate"}
Job Title: ${jobTitle || "the open role"}

Rules:
1. Write in a professional, direct tone.
2. No generic fluff like "I am excited to apply" or "I came across your job posting".
3. No storytelling. Get straight to the point.
4. Keep the body strictly between 8 to 12 lines.
5. Explicitly mention the job role: "${jobTitle || "the open role"}".
6. ${skillFocus}
7. Make it sound human, not robotic.
8. Output ONLY valid JSON matching the required schema.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const rawContent = response.choices[0]?.message?.content;
    
    if (!rawContent) {
      throw new RetryableError("Empty response from OpenAI");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      throw new RetryableError("Invalid JSON from OpenAI");
    }

    const validation = emailResponseSchema.safeParse(parsed);
    if (!validation.success) {
      throw new NonRetryableError(`Zod validation failed: ${validation.error.message}`);
    }

    return validation.data;

  } catch (error) {
    if (error instanceof NonRetryableError || error instanceof RetryableError) {
      throw error;
    }
    
    // Convert 5xx, 429, timeouts to Retryable
    if (error.status >= 500 || error.status === 429 || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      throw new RetryableError(`OpenAI API error: ${error.message}`);
    }

    throw new NonRetryableError(`Unexpected error during email generation: ${error.message}`);
  }
};

module.exports = {
  generateApplicationEmail,
  NonRetryableError,
  RetryableError
};
