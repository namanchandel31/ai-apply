const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const { withRetry } = require("../utils/retry");
const { getCache, setCache, deleteCache } = require("../utils/cache");
const { logInfo, logError } = require("../utils/logger");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { isValidEmail, isValidPhone } = require("../utils/validators");
const { sanitizeTextForLlm, sanitizeTextForStorage, sanitizeErrorMessage } = require("../utils/textSanitize");
const { callOpenAIJson } = require("./llmClient");
const { SYSTEM_PROMPT: JD_SYSTEM_PROMPT } = require("../prompts/jdParsePrompt");
const { RESUME_SYSTEM_PROMPT } = require("../prompts/resumeParsePrompt");
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
// Helpers
// ---------------------------------------------------------------------

const extractText = async (buffer) => {
  try {
    const startTime = Date.now();
    let text = "";

    const data = await pdfParse(buffer);
    text = data.text || "";

    logInfo("PDF_TEXT_EXTRACTED", {
      extractedTextChars: text.length,
      first200CharsPreview: text.substring(0, 500).replace(/\n/g, " ").trim()
    });

    const extractDurationMs = Date.now() - startTime;

    const sanitizeStart = Date.now();
    const sanitized = sanitizeTextForStorage(text);
    const sanitizationDurationMs = Date.now() - sanitizeStart;

    return { raw: text, sanitized, extractDurationMs, sanitizationDurationMs };
  } catch (error) {
    logError("PDF_EXTRACTION_ERROR", error, {
      message: error.message
    });
    // Preserve original error message and stack trace for debugging
    throw new NonRetryableError(`PDF Text Extraction Failed: ${error.message}`);
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
 * Process a Resume.
 * Note: This executes the parsing job synchronously within the current process.
 * In a future scaling phase, this will become the background worker logic.
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
  signal,
}) => {
  if (inflightJobs.has(fileHash)) {
    logInfo("concurrency_dedup_hit", { reqId, jobId, stage: "job_started", fileHash, source: "resume" });
    return inflightJobs.get(fileHash);
  }

  const jobPromise = (async () => {
    let sanitizedRaw = null;

    try {
      logInfo("PDF_EXTRACTION_STARTED", { reqId, jobId, fileHash });
      const extractResult = await extractText(buffer);
      const rawText = extractResult.raw;
      sanitizedRaw = extractResult.sanitized;

      logInfo("PDF_EXTRACTION_COMPLETED", { reqId, jobId, fileHash, elapsedMs: extractResult.extractDurationMs });
      logInfo("PDF_RAW_TEXT_LENGTH", { reqId, jobId, rawChars: rawText.length });
      logInfo("PDF_SANITIZED_TEXT_LENGTH", { reqId, jobId, sanitizedChars: sanitizedRaw.length });

      if (!sanitizedRaw) throw new NonRetryableError("Extraction Failed");

      const cleanedText = sanitizeTextForLlm(sanitizedRaw, MAX_LLM_INPUT_CHARS);

      const config = require("../config");
      const isTimingsEnabled = config.logging.hasDebugScope("llm");
      const isExtractionOnlyEnabled = config.logging.hasDebugScope("llm");

      if (isTimingsEnabled || isExtractionOnlyEnabled) {
        try {
          const debugDir = path.join(process.cwd(), "debug", "resume-extraction");
          fs.mkdirSync(debugDir, { recursive: true });

          const rawPath = path.join(debugDir, `${reqId}_raw.txt`);
          fs.writeFileSync(rawPath, rawText, "utf-8");
          const rawSize = fs.statSync(rawPath).size;
          logInfo("PDF_RAW_FILE_WRITTEN", { absolutePath: rawPath, reqId, size: rawSize });

          const sanitizedPath = path.join(debugDir, `${reqId}_sanitized.txt`);
          fs.writeFileSync(sanitizedPath, cleanedText, "utf-8");
          const sanitizedSize = fs.statSync(sanitizedPath).size;
          logInfo("PDF_SANITIZED_FILE_WRITTEN", { absolutePath: sanitizedPath, reqId, size: sanitizedSize });

          const metrics = {
            rawCharCount: rawText.length,
            sanitizedCharCount: cleanedText.length,
            pageCount: rawText.split('\f').length,
            extractionDurationMs: extractResult.extractDurationMs,
            sanitizationDurationMs: extractResult.sanitizationDurationMs,
          };

          const metricsPath = path.join(debugDir, `${reqId}_metrics.json`);
          fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
          const metricsSize = fs.statSync(metricsPath).size;
          logInfo("PDF_METRICS_FILE_WRITTEN", { absolutePath: metricsPath, reqId, size: metricsSize });

          logInfo("PDF_DEBUG_FILES_WRITTEN", { reqId, jobId, fileHash, debugDir });

        } catch (debugErr) {
          logError("PDF_DEBUG_METRICS_ERROR", debugErr, { reqId, jobId });
        }
      }

      // SHORT CIRCUIT PIPELINE
      if (isExtractionOnlyEnabled) {
        return {
          jobId,
          status: "completed",
          data: {
            success: true,
            debugMode: true,
            message: "Resume extraction debug files generated."
          }
        };
      }

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

          if (config.server.testMode) {
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
            if (config.server.forceLlmError) {
              if (config.server.isDevelopment) {
                logInfo("LLM_FORCE_ERROR_TEST_MODE_ENABLED", { reqId, jobId, message: "Simulating LLM error for testing" });
                throw new RetryableError("Simulated LLM error");
              } else {
                logError("LLM_FORCE_ERROR_PRODUCTION_WARNING", new Error("FORCE_LLM_ERROR is set in production"), { reqId, jobId });
              }
            }

            const userPrompt = `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}`;
            const parsed = await callOpenAIJson({
              systemPrompt: RESUME_SYSTEM_PROMPT,
              userPrompt,
              reqId,
              jobId,
              source: "resume",
              attempt,
              signal,
              userId,
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
      }, { ...llmRetryOptions, signal });

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
 * Process a Job Description.
 * Note: This executes the parsing job synchronously within the current process.
 * In a future scaling phase, this will become the background worker logic.
 */
const processJDJob = async ({ reqId, jobId, title, text, fileHash, userId = null, signal }) => {
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

          if (config.server.testMode) {
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
            const { parseJobDescription } = require("./jdParseService");
            if (!userId) {
              throw new NonRetryableError("userId is required for JD parsing");
            }
            parsedData = await parseJobDescription(cleanedText, userId, { reqId });
            logInfo("llm_success", { reqId, jobId, stage: "llm_parsing", attempt, fileHash });
          }

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
      }, { ...llmRetryOptions, signal });

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

/**
 * Orchestration Abstractions
 * 
 * TODO: In the future, these methods should place the job payload onto dedicated queues:
 * - Resume Parsing Queue
 * - JD Parsing Queue
 * - Email Generation Queue
 * 
 * Currently, they execute synchronously to maintain the existing architecture,
 * but abstract the orchestration boundary from the HTTP controllers.
 */
const enqueueResumeParsing = (params) => {
  return processResumeJob(params);
};

const enqueueJDParsing = (params) => {
  return processJDJob(params);
};

module.exports = {
  processResumeJob,
  processJDJob,
  enqueueResumeParsing,
  enqueueJDParsing,
  extractText,
};
