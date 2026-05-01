const crypto = require("crypto");
const OpenAI = require("openai");
const pdfParse = require('pdf-parse');
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { safeParseJSON } = require("../utils/json");
const { ResumeSchema } = require("../schemas/resumeSchema");
const { normalizeSkills } = require("../utils/normalise");
const { findResumeByHash, createResumeWithParsedData } = require("../models/resumeModel");

// Lazy load OpenAI client to allow dynamic env changes in tests
const getOpenAIClient = () => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); 

const MODEL = "gpt-4.1-mini"; 
const MAX_INPUT_LENGTH = 10000; 
const LLM_TIMEOUT_MS = 15000; // 15 seconds

// ---------------------------------------------------------------------
// SYSTEM PROMPT
// ------------------------
const SYSTEM_PROMPT = `You are a highly accurate resume parsing engine.

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

/**
 * Extract raw text from PDF buffer
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
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
        // Graceful extraction fallback if local pdf-parse module is corrupted/incompatible
        text = buffer.toString('utf-8');
    }
    return text || "";
  } catch (error) {
    console.error(`[Extraction Error] Failed to parse PDF text: ${error.message}`);
    throw new Error("PDF Text Extraction Failed");
  }
};

/**
 * Cleans and normalizes raw text content
 * @param {string} rawText
 * @returns {string}
 */
const cleanText = (rawText) => {
  let cleaned = rawText
    .replace(/\r\n/g, '\n')     // Convert CR+LF to LF
    .replace(/(\n\s*){3,}/g, '\n\n') // Clean excessive blank lines
    .replace(/[ \t]+$/gm, '')   // Remove trailing whitespace from lines
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

/**
 * Coordinates the call to OpenAI API to structure the data
 * @param {string} cleanedText - The cleaned text from the resume.
 * @param {number} attempt - Current retry attempt number.
 * @returns {Promise<string>} The raw string output from LLM.
 */
const callOpenAI = async (cleanedText, attempt) => {
  if (process.env.TEST_MODE === 'true') {
    return JSON.stringify({
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
      certifications: []
    });
  }

  if (process.env.FORCE_LLM_ERROR === 'true') {
    throw new RetryableError(`Simulated LLM Failure (Attempt ${attempt})`);
  }

  const openai = getOpenAIClient();

  const llmPromise = openai.responses.create({
    model: MODEL,
    temperature: 0,
    text: {
      format: {
        type: "json_object"
      }
    },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}` },
    ],
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new RetryableError("LLM response timed out")), LLM_TIMEOUT_MS)
  );

  let response;
  try {
    response = await Promise.race([llmPromise, timeoutPromise]);
  } catch (err) {
    throw new RetryableError(`OpenAI API request failed (Attempt ${attempt}): ${err.message}`);
  }

  const content = response.output
    ?.flatMap((o) => o.content || [])
    ?.find((c) => c.type === "output_text")
    ?.text
    ?.trim();

  if (!content) {
    throw new RetryableError("OpenAI returned empty content.");
  }
  
  return content;
};

/**
 * Main orchestrating function to parse the resume text using LLM
 * Implements retry logic and Zod validation.
 * @param {string} cleanedText - The cleaned text extracted from the PDF.
 * @returns {Promise<object>} The final structured data object.
 */
const parseWithLLM = async (cleanedText) => {
  return await withRetry(
    async (attempt) => {
      let raw;
      try {
        raw = await callOpenAI(cleanedText, attempt);
      } catch (err) {
        console.error("RESUME_PARSE_ERROR", { attempt, error: err.message });
        throw err;
      }

      const parsed = safeParseJSON(raw);
      if (!parsed) {
        const err = new RetryableError(`JSON parse failed (attempt ${attempt})`);
        console.error("RESUME_PARSE_ERROR", { attempt, error: err.message });
        throw err;
      }

      const result = ResumeSchema.safeParse(parsed);
      if (!result.success) {
        // Schema mismatch is permanent
        throw new NonRetryableError(
          `Schema validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`
        );
      }

      return result.data;
    },
    { maxAttempts: 3, baseDelayMs: 1000 }
  );
};

// ---------------------------------------------------------------------
// PUBLIC API CONTROLLER (Implementation)
// ------------------------
const uploadResumeController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file' });
    }
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Invalid mimetype' });
    }
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File size exceeds 2MB' });
    }

    // 0. DEDUPLICATION CHECK (O(1) lookup using file hash)
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const existing = await findResumeByHash(fileHash);
    
    if (existing) {
      console.log(`[${reqId}] Dedup hit: Resume already parsed (Hash: ${fileHash})`);
      return res.status(200).json({
        success: true,
        resumeId: existing.resumeId,
        parsedResumeId: existing.parsedResumeId,
        data: existing.parsedJson,
        message: 'Resume retrieved from cache'
      });
    }

    // 1. PDF TEXT EXTRACTION
    console.log(`[${reqId}] Starting PDF text extraction...`);
    const rawText = await extractText(req.file.buffer);

    if (!rawText) {
      return res.status(400).json({
        success: false,
        message: 'Failed to extract any text from the PDF.',
      });
    }
    
    // 2. TEXT CLEANING
    const cleanedText = cleanText(rawText);
    console.log(`[${reqId}] Text cleaned. Length: ${cleanedText.length}`);

    if (!cleanedText || cleanedText.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Resume content too weak to parse'
      });
    }

    // 3. LLM PARSING (with Zod validation)
    console.log(`[${reqId}] Calling LLM for structured parsing...`);
    const parsedData = await parseWithLLM(cleanedText);

    // Sanitize skills
    parsedData.skills = normalizeSkills(parsedData.skills);
    
    // 4. PERSISTENCE (Transactional)
    console.log(`[${reqId}] Persisting parsed resume...`);
    let dbResult;
    try {
      dbResult = await createResumeWithParsedData(
        req.file.originalname,
        req.file.size,
        fileHash,
        cleanedText,
        parsedData
      );
    } catch (dbErr) {
      console.error(`[${reqId}] DB Persistence Error:`, dbErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to store resume data",
      });
    }

    // 5. SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      resumeId: dbResult.resumeId,
      parsedResumeId: dbResult.parsedResumeId,
      data: parsedData,
      message: 'Resume processed and stored successfully'
    });

  } catch (error) {
    let status = 500;
    let message = 'Failed to process resume due to internal error.';

    if (error.message.includes('Extraction Failed')) {
      status = 400;
      message = error.message; 
    } else if (error instanceof NonRetryableError || error.message.includes("Parsing failed permanently")) {
        status = 400;
        message = `Parsing failed: ${error.message}`;
    } else if (error.message.includes('Schema validation failed')) {
        status = 400;
        message = error.message;
    } else {
        message = `Processing error: ${error.message}`;
    }
    
    console.error(`[${reqId}] [CRITICAL_ERROR]`, error);
    return res.status(status).json({
      success: false,
      message: message,
    });
  }
};

module.exports = {
  uploadResumeController,
  // Exported for testing only
  cleanText,
  parseWithLLM
};
