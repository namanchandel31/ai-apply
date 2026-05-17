const OpenAI = require("openai");
const pdfParse = require("pdf-parse");

const { withRetry } = require("../utils/retry");
const { getCache, setCache, deleteCache } = require("../utils/cache");
const { logInfo, logError } = require("../utils/logger");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { isValidEmail, isValidPhone } = require("../utils/validators");
const { sanitizeTextForLlm, sanitizeTextForStorage, sanitizeErrorMessage } = require("../utils/textSanitize");
const { callOpenAIJson } = require("./llmClient");
const {
  LLM_MAX_ATTEMPTS,
  LLM_RETRY_BASE_DELAY_MS,
  MAX_LLM_INPUT_CHARS,
} = require("../config/parsingConfig");

const { ResumeSchema } = require("../schemas/resumeSchema");
const { JDSchema } = require("../schemas/jdSchema");

const { createResumeWithParsedData } = require("../models/resumeModel");
const { createJDWithParsedData } = require("../models/jdModel");
const { saveFailedParse } = require("../models/failedParseModel");

// ---------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------
const RESUME_SYSTEM_PROMPT = `You are a highly accurate resume parsing engine.

STRICT RULES:
* Output ONLY valid JSON matching the exact schema.
* ALWAYS include all schema fields.
* Do NOT add extra fields.
* Do NOT hallucinate.
* Missing values must be null or empty arrays.
* Normalize output.
* Remove duplicate skills.

SCHEMA:
{
"name": string | null,
"email": string | null,
"phone": string | null,
"location": string | null,
"linkedin": string | null,
"github": string | null,
"portfolio": string | null,
"summary": string | null,
"skills": string[],
"experience": [
{
"company": string | null,
"role": string | null,
"location": string | null,
"start_date": string | null,
"end_date": string | null,
"duration": string | null,
"description": string | null
}
],
"education": [
{
"institution": string | null,
"degree": string | null,
"field_of_study": string | null,
"start_date": string | null,
"end_date": string | null
}
],
"projects": [
{
"name": string | null,
"description": string | null,
"technologies": string[]
}
],
"certifications": string[]
}`;

const JD_SYSTEM_PROMPT = `You are a precise job description parser. Extract information ONLY from what is explicitly stated in the text.

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

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

const extractText = async (buffer) => {
  try {
    let text = "";
    if (typeof pdfParse === "function") {
      const data = await pdfParse(buffer);
      text = data.text || "";
    } else if (pdfParse && typeof pdfParse.default === "function") {
      const data = await pdfParse.default(buffer);
      text = data.text || "";
    } else {
      text = buffer.toString("utf-8");
    }
    const sanitized = sanitizeTextForStorage(text);
    logInfo("pdf_extract_complete", { rawChars: text.length, sanitizedChars: sanitized.length });
    return sanitized;
  } catch (error) {
    throw new NonRetryableError("PDF Text Extraction Failed");
  }
};

const persistFailedParse = async (fileHash, sourceType, rawText, err, meta) => {
  try {
    await saveFailedParse(
      fileHash,
      sourceType,
      rawText,
      sanitizeErrorMessage(err)
    );
    logInfo("fallback_saved", { ...meta, fileHash, sourceType });
  } catch (dbErr) {
    logError("fallback_storage_failed", dbErr, {
      ...meta,
      fileHash,
      sourceType,
      pgCode: dbErr.code,
    });
  }
};

const llmRetryOptions = {
  maxAttempts: LLM_MAX_ATTEMPTS,
  baseDelayMs: LLM_RETRY_BASE_DELAY_MS,
};

// Inflight request cache to deduplicate concurrent requests
const inflightJobs = new Map();

/**
 * Process a Resume (decoupled from HTTP — may run in background job registry).
 */
const processResumeJob = async ({
  reqId,
  jobId,
  buffer,
  originalname,
  size,
  fileHash,
  userId = null,
  filePath = null,
}) => {
  if (inflightJobs.has(fileHash)) {
    logInfo("concurrency_dedup_hit", { reqId, jobId, stage: "job_started", fileHash, source: "resume" });
    return inflightJobs.get(fileHash);
  }

  const jobPromise = (async () => {
    let sanitizedRaw = null;

    try {
      sanitizedRaw = await extractText(buffer);
      if (!sanitizedRaw) throw new NonRetryableError("Extraction Failed");

      const cleanedText = sanitizeTextForLlm(sanitizedRaw, MAX_LLM_INPUT_CHARS);

      logInfo("resume_text_prepared", {
        reqId,
        jobId,
        fileHash,
        sanitizedChars: cleanedText.length,
      });

      if (cleanedText.length < 50) {
        throw new NonRetryableError("Resume content too weak to parse");
      }

      const data = await withRetry(async (attempt) => {
        try {
          const cached = getCache(fileHash);
          if (cached) {
            logInfo("cache_hit", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            const dbResult = await createResumeWithParsedData(
              originalname,
              size,
              fileHash,
              cleanedText,
              cached,
              userId,
              filePath
            );
            return { ...cached, _dbIds: dbResult };
          }

          logInfo("llm_start", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });

          let parsedData;

          if (process.env.TEST_MODE === "true") {
            parsedData = {
              name: "John Doe",
              email: "john@example.com",
              phone: "1234567890",
              location: "India",
              linkedin: null,
              github: null,
              portfolio: null,
              summary: "Mock summary",
              skills: ["javascript", "node.js"],
              experience: [],
              education: [],
              projects: [],
              certifications: [],
            };
          } else {
            if (process.env.FORCE_LLM_ERROR === "true") {
              throw new RetryableError("Simulated LLM error");
            }

            const userPrompt = `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}`;
            const parsed = await callOpenAIJson({
              systemPrompt: RESUME_SYSTEM_PROMPT,
              userPrompt,
              reqId,
              jobId,
              source: "resume",
              attempt,
            });

            const result = ResumeSchema.safeParse(parsed);
            if (!result.success) {
              throw new NonRetryableError(
                `Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`
              );
            }

            parsedData = result.data;
            logInfo("llm_success", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
          }

          if (!parsedData.skills?.length || !parsedData.name || !parsedData.email) {
            throw new NonRetryableError("invalid_parsed_content");
          }

          parsedData.skills = normalizeSkills(parsedData.skills);
          setCache(fileHash, parsedData);

          logInfo("db_persist_start", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          const dbResult = await createResumeWithParsedData(
            originalname,
            size,
            fileHash,
            cleanedText,
            parsedData,
            userId,
            filePath
          );
          logInfo("db_write_success", { reqId, jobId, stage: "db_persist", attempt, fileHash });

          deleteCache(fileHash);
          return { ...parsedData, _dbIds: dbResult };
        } catch (innerErr) {
          if (innerErr instanceof RetryableError) {
            logError("llm_retry", innerErr, {
              reqId,
              jobId,
              stage: "llm_parsing",
              attempt,
              fileHash,
              status: "retry",
              maxAttempts: LLM_MAX_ATTEMPTS,
            });
          }
          throw innerErr;
        }
      }, llmRetryOptions);

      return {
        jobId,
        status: "completed",
        data,
      };
    } catch (err) {
      logError("job_failed", err, { reqId, jobId, stage: "failure", fileHash, source: "resume" });

      if (sanitizedRaw) {
        await persistFailedParse(fileHash, "resume", sanitizedRaw, err, { reqId, jobId, stage: "fallback" });
      }

      throw err;
    } finally {
      inflightJobs.delete(fileHash);
    }
  })();

  inflightJobs.set(fileHash, jobPromise);
  return jobPromise;
};

/**
 * Process a Job Description
 */
const processJDJob = async ({ reqId, jobId, title, text, fileHash, userId = null }) => {
  if (inflightJobs.has(fileHash)) {
    logInfo("concurrency_dedup_hit", { reqId, jobId, stage: "job_started", fileHash, source: "jd" });
    return inflightJobs.get(fileHash);
  }

  const jobPromise = (async () => {
    const cleanedText = sanitizeTextForLlm(text, MAX_LLM_INPUT_CHARS);

    try {
      const data = await withRetry(async (attempt) => {
        try {
          const cached = getCache(fileHash);
          if (cached) {
            logInfo("cache_hit", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            const dbResult = await createJDWithParsedData(title || null, cleanedText, cached, userId);
            return { ...cached, _dbIds: dbResult };
          }

          logInfo("llm_start", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });

          let parsedData;

          if (process.env.TEST_MODE === "true") {
            parsedData = {
              job_title: "Senior React Engineer",
              company_name: null,
              contact_person: null,
              location: "Remote",
              contact_email: "jobs@example.com",
              contact_number: null,
              job_type: "Remote",
              skills: ["react", "node.js"],
            };
          } else {
            const parsed = await callOpenAIJson({
              systemPrompt: JD_SYSTEM_PROMPT,
              userPrompt: cleanedText,
              reqId,
              jobId,
              source: "jd",
              attempt,
            });

            const result = JDSchema.safeParse(parsed);
            if (!result.success) {
              throw new NonRetryableError(
                `Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`
              );
            }

            parsedData = result.data;
            logInfo("llm_success", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
          }

          if (!parsedData.skills?.length || !parsedData.job_title) {
            throw new NonRetryableError("invalid_parsed_content");
          }

          parsedData.skills = normalizeSkills(parsedData.skills);
          parsedData.job_title = nullifyEmpty(parsedData.job_title);
          parsedData.company_name = nullifyEmpty(parsedData.company_name);
          parsedData.contact_person = nullifyEmpty(parsedData.contact_person);
          parsedData.location = nullifyEmpty(parsedData.location);
          if (!isValidEmail(parsedData.contact_email)) parsedData.contact_email = null;
          if (!isValidPhone(parsedData.contact_number)) parsedData.contact_number = null;

          setCache(fileHash, parsedData);

          logInfo("db_persist_start", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          const dbResult = await createJDWithParsedData(title || null, cleanedText, parsedData, userId);
          logInfo("db_write_success", { reqId, jobId, stage: "db_persist", attempt, fileHash });

          deleteCache(fileHash);
          return { ...parsedData, _dbIds: dbResult };
        } catch (innerErr) {
          if (innerErr instanceof RetryableError) {
            logError("llm_retry", innerErr, {
              reqId,
              jobId,
              stage: "llm_parsing",
              attempt,
              fileHash,
              status: "retry",
            });
          }
          throw innerErr;
        }
      }, llmRetryOptions);

      return {
        jobId,
        status: "completed",
        data,
      };
    } catch (err) {
      logError("job_failed", err, { reqId, jobId, stage: "failure", fileHash, source: "jd" });
      await persistFailedParse(fileHash, "jd", cleanedText, err, { reqId, jobId, stage: "fallback" });
      throw err;
    } finally {
      inflightJobs.delete(fileHash);
    }
  })();

  inflightJobs.set(fileHash, jobPromise);
  return jobPromise;
};

module.exports = {
  processResumeJob,
  processJDJob,
  extractText,
};
