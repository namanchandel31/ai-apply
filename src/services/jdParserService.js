const OpenAI = require("openai");

const { safeParseJSON } = require("../utils/json");
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { isValidEmail, isValidPhone, isNonEmptyString } = require("../utils/validators");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { JDSchema } = require("../schemas/jdSchema");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const MAX_INPUT_LENGTH = 5000;
const MODEL = "gpt-4.1-mini";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a precise job description parser. Extract information ONLY from what is explicitly stated in the text.

Return a single valid JSON object with exactly these fields:
{
  "job_title": string or null,
  "company_name": string or null,
  "contact_person": string or null,
  "location": string or null,
  "contact_email": string or null,
  "contact_number": string or null,
  "job_type": "Remote" | "Hybrid" | "Onsite" | "Unknown" | null,
  "skills": []
}

Rules (follow strictly):
- Return ONLY the JSON object. No markdown, no explanation, no extra text.
- Do NOT infer or guess any value. If not explicitly stated → null.
- job_type: use "Remote", "Hybrid", or "Onsite" only if explicitly mentioned. Use "Unknown" if work-mode is referenced but unclear. Use null if not mentioned at all.
- skills: extract only explicitly listed skills/technologies. Return as an array of strings. Empty array if none found.
- contact_email: must be a valid-looking email or null.
- contact_number: must be an actual phone number or null.`;

// ---------------------------------------------------------------------------
// OpenAI call
// ---------------------------------------------------------------------------
const callOpenAI = async (rawText) => {
  let response;

  try {
    response = await openai.responses.create({
      model: MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_object"
        }
      },
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
    });
  } catch (err) {
    throw new RetryableError(`OpenAI request failed: ${err.message}`);
  }

  const content = response.output
    ?.flatMap((o) => o.content || [])
    ?.find((c) => c.type === "output_text")
    ?.text
    ?.trim();

  if (!content) {
    throw new RetryableError("OpenAI returned empty or malformed response");
  }

  return content;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const parseJobDescription = async (rawText) => {
  if (!isNonEmptyString(rawText)) {
    throw new Error("parseJobDescription: rawText must be a non-empty string");
  }

  const text = rawText.trim().slice(0, MAX_INPUT_LENGTH);
  const snippet = text.slice(0, 100);

  const data = await withRetry(
    async (attempt) => {
      let raw;

      try {
        raw = await callOpenAI(text);
      } catch (err) {
        console.error("JD_PARSE_ERROR", { attempt, error: err.message, snippet });
        throw err; // RetryableError — withRetry will handle backoff
      }

      const parsed = safeParseJSON(raw);
      if (!parsed) {
        const err = new RetryableError(`JSON parse failed (attempt ${attempt}): ${raw}`);
        console.error("JD_PARSE_ERROR", { attempt, error: err.message, snippet });
        throw err;
      }

      const result = JDSchema.safeParse(parsed);
      if (!result.success) {
        // Schema mismatch is permanent — do not retry
        throw new NonRetryableError(
          `Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`
        );
      }

      return result.data;
    },
    { maxAttempts: MAX_RETRIES, baseDelayMs: 500 }
  );

  // Post-validation sanitization
  data.skills = normalizeSkills(data.skills);
  data.job_title = nullifyEmpty(data.job_title);
  data.company_name = nullifyEmpty(data.company_name);
  data.contact_person = nullifyEmpty(data.contact_person);
  data.location = nullifyEmpty(data.location);
  if (!isValidEmail(data.contact_email)) data.contact_email = null;
  if (!isValidPhone(data.contact_number)) data.contact_number = null;

  return data;
};

module.exports = { parseJobDescription };
