const crypto = require("crypto");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");

const { withRetry } = require("../utils/retry");
const { getCache, setCache, deleteCache } = require("../utils/cache");
const { logInfo, logError } = require("../utils/logger");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { safeParseJSON } = require("../utils/json");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { isValidEmail, isValidPhone } = require("../utils/validators");

const { ResumeSchema } = require("../schemas/resumeSchema");
const { JDSchema } = require("../schemas/jdSchema");

const { createResumeWithParsedData } = require("../models/resumeModel");
const { createJDWithParsedData } = require("../models/jdModel");
const { saveFailedParse } = require("../models/failedParseModel");

const MODEL = "gpt-4.1-mini";
const MAX_INPUT_LENGTH = 10000;
const LLM_TIMEOUT_MS = 15000; // 15s

const getOpenAIClient = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      text = data.text || "";
    } else if (pdfParse && typeof pdfParse.default === 'function') {
      const data = await pdfParse.default(buffer);
      text = data.text || "";
    } else {
      text = buffer.toString('utf-8');
    }
    return text || "";
  } catch (error) {
    throw new NonRetryableError("PDF Text Extraction Failed");
  }
};

const cleanText = (rawText) => {
  let cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/(\n\s*){3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
  
  if (cleaned.length > MAX_INPUT_LENGTH) {
    const keepStart = Math.floor(MAX_INPUT_LENGTH * 0.6);
    const keepEnd = MAX_INPUT_LENGTH - keepStart - 5;
    const firstPart = cleaned.substring(0, keepStart);
    const lastPart = cleaned.substring(cleaned.length - keepEnd);
    cleaned = firstPart + "\n...\n" + lastPart;
  }
  return cleaned;
};

const callOpenAI = async (systemPrompt, userPrompt) => {
  const openai = getOpenAIClient();

  const llmPromise = openai.responses.create({
    model: MODEL,
    temperature: 0,
    text: { format: { type: "json_object" } },
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new RetryableError("LLM response timed out")), LLM_TIMEOUT_MS)
  );

  let response;
  try {
    response = await Promise.race([llmPromise, timeoutPromise]);
  } catch (err) {
    // Determine if it's an HTTP status error
    if (err.status && [429, 500, 502, 503, 504].includes(err.status)) {
        throw new RetryableError(`OpenAI request failed: ${err.message}`);
    } else if (err instanceof RetryableError) {
        throw err; // Timeout
    }
    throw new NonRetryableError(`OpenAI permanent failure: ${err.message}`);
  }

  const content = response.output
    ?.flatMap((o) => o.content || [])
    ?.find((c) => c.type === "output_text")
    ?.text
    ?.trim();

  if (!content) {
    throw new NonRetryableError("OpenAI returned empty content");
  }
  
  return content;
};

// ---------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------

// Inflight request cache to deduplicate concurrent requests
const inflightJobs = new Map();

/**
 * Process a Resume
 */
const processResumeJob = async ({ reqId, jobId, buffer, originalname, size, fileHash }) => {
  if (inflightJobs.has(fileHash)) {
    logInfo("concurrency_dedup_hit", { reqId, jobId, stage: "job_started", fileHash, source: "resume" });
    return inflightJobs.get(fileHash);
  }

  const jobPromise = (async () => {
    let rawText = null;

    try {
      rawText = await extractText(buffer);
      if (!rawText) throw new NonRetryableError("Extraction Failed");
      const cleanedText = cleanText(rawText);

      if (cleanedText.length < 50) {
        throw new NonRetryableError("Resume content too weak to parse");
      }

      const data = await withRetry(async (attempt) => {
        let parsedData;
        
        try {
          const cached = getCache(fileHash);
          if (cached) {
            logInfo("cache_hit", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            parsedData = cached;
          } else {
            logInfo("llm_start", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            
            if (process.env.TEST_MODE === 'true') {
               parsedData = {
                  name: "John Doe", email: "john@example.com", phone: "1234567890", location: "India",
                  linkedin: null, github: null, portfolio: null, summary: "Mock summary",
                  skills: ["javascript", "node.js"], experience: [], education: [], projects: [], certifications: []
               };
            } else {
               if (process.env.FORCE_LLM_ERROR === 'true') {
                   throw new RetryableError("Simulated LLM error");
               }
               const userPrompt = `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}`;
               const raw = await callOpenAI(RESUME_SYSTEM_PROMPT, userPrompt);
               
               const parsed = safeParseJSON(raw);
               if (!parsed) throw new NonRetryableError("JSON parse failed");
               
               const result = ResumeSchema.safeParse(parsed);
               if (!result.success) throw new NonRetryableError(`Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
               
               parsedData = result.data;
               logInfo("llm_success", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            }
            
            // Lightweight Sanity Checks
            if (!parsedData.skills?.length || !parsedData.name || !parsedData.email) {
              throw new NonRetryableError("invalid_parsed_content");
            }

            parsedData.skills = normalizeSkills(parsedData.skills);
            
            // Save to cache before DB persist
            setCache(fileHash, parsedData);
          }

          logInfo("db_persist_start", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          const dbResult = await createResumeWithParsedData(originalname, size, fileHash, cleanedText, parsedData);
          logInfo("db_write_success", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          
          // Clear cache on DB success to prevent memory bloat
          deleteCache(fileHash);
          
          return { ...parsedData, _dbIds: dbResult };
        } catch (innerErr) {
          if (innerErr instanceof RetryableError) {
             logError("llm_retry", innerErr, { reqId, jobId, stage: "llm_parsing", attempt, fileHash, status: "retry" });
          }
          throw innerErr;
        }
      });
      
      return {
        jobId,
        status: "completed",
        data
      };

    } catch (err) {
      logError("job_failed", err, { reqId, jobId, stage: "failure", fileHash });
      
      // Fallback rule: only store if raw_text exists
      if (rawText) {
        await saveFailedParse(fileHash, "resume", rawText, err.message)
          .then(() => {
            logInfo("fallback_saved", { reqId, jobId, stage: "fallback", fileHash });
          })
          .catch(dbErr => {
            logError("fallback_storage_failed", dbErr, { reqId, jobId, stage: "fallback", fileHash });
          });
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
const processJDJob = async ({ reqId, jobId, title, text, fileHash }) => {
  if (inflightJobs.has(fileHash)) {
    logInfo("concurrency_dedup_hit", { reqId, jobId, stage: "job_started", fileHash, source: "jd" });
    return inflightJobs.get(fileHash);
  }

  const jobPromise = (async () => {
    try {
      const cleanedText = text.trim().slice(0, MAX_INPUT_LENGTH);

      const data = await withRetry(async (attempt) => {
        let parsedData;
        
        try {
          const cached = getCache(fileHash);
          if (cached) {
            logInfo("cache_hit", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            parsedData = cached;
          } else {
            logInfo("llm_start", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            
            if (process.env.TEST_MODE === 'true') {
               parsedData = {
                  job_title: "Senior React Engineer", company_name: null, contact_person: null,
                  location: "Remote", contact_email: "jobs@example.com", contact_number: null,
                  job_type: "Remote", skills: ["react", "node.js"]
               };
            } else {
                const raw = await callOpenAI(JD_SYSTEM_PROMPT, cleanedText);
                
                const parsed = safeParseJSON(raw);
                if (!parsed) throw new NonRetryableError("JSON parse failed");
                
                const result = JDSchema.safeParse(parsed);
                if (!result.success) throw new NonRetryableError(`Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
                
                parsedData = result.data;
                logInfo("llm_success", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
            }
            
            // Lightweight Sanity Checks
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
            
            // Save to cache before DB persist
            setCache(fileHash, parsedData);
          }

          logInfo("db_persist_start", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          const dbResult = await createJDWithParsedData(title || null, cleanedText, parsedData);
          logInfo("db_write_success", { reqId, jobId, stage: "db_persist", attempt, fileHash });
          
          // Clear cache on DB success
          deleteCache(fileHash);
          
          return { ...parsedData, _dbIds: dbResult };
        } catch (innerErr) {
          if (innerErr instanceof RetryableError) {
             logError("llm_retry", innerErr, { reqId, jobId, stage: "llm_parsing", attempt, fileHash, status: "retry" });
          }
          throw innerErr;
        }
      });

      return {
        jobId,
        status: "completed",
        data
      };

    } catch (err) {
      logError("job_failed", err, { reqId, jobId, stage: "failure", fileHash });
      
      // Always have rawText for JD
      await saveFailedParse(fileHash, "jd", text, err.message)
        .then(() => {
          logInfo("fallback_saved", { reqId, jobId, stage: "fallback", fileHash });
        })
        .catch(dbErr => {
          logError("fallback_storage_failed", dbErr, { reqId, jobId, stage: "fallback", fileHash });
        });
      
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
  processJDJob
};
