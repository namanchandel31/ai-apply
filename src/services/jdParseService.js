const { generateStructuredJson } = require("./aiGateway");
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { isValidEmail, isValidPhone, isNonEmptyString } = require("../utils/validators");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { JDSchema } = require("../schemas/jdSchema");
const { SYSTEM_PROMPT, PROMPT_VERSION } = require("../prompts/jdParsePrompt");

const MAX_INPUT_LENGTH = 15000;

const parseJobDescription = async (rawText, userId, meta = {}) => {
  if (!userId) throw new Error("parseJobDescription: userId is required");
  if (!isNonEmptyString(rawText)) {
    throw new Error("parseJobDescription: rawText must be a non-empty string");
  }

  const text = rawText.trim().slice(0, MAX_INPUT_LENGTH);

  const parsed = await withRetry(async () => {
    const result = await generateStructuredJson({
      userId,
      task: "jd_parse",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: text,
      promptVersion: PROMPT_VERSION,
      reqId: meta.reqId,
      endpoint: "jd_parse",
    });

    const validation = JDSchema.safeParse(result);
    if (!validation.success) {
      throw new NonRetryableError(
        `Schema validation failed: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
      );
    }
    return validation.data;
  }, { maxAttempts: 3 });

  const data = parsed;
  if (data.contact_email && !isValidEmail(data.contact_email)) data.contact_email = null;
  if (data.contact_number && !isValidPhone(data.contact_number)) data.contact_number = null;
  data.skills = normalizeSkills(data.skills || []);
  data.job_title = nullifyEmpty(data.job_title);
  data.company_name = nullifyEmpty(data.company_name);

  if (!data.skills?.length || !data.job_title) {
    throw new NonRetryableError("invalid_parsed_content");
  }

  return data;
};

module.exports = { parseJobDescription, PROMPT_VERSION };
