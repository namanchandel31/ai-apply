const OpenAI = require("openai");
const pdfParse = require('pdf-parse');
const { withRetry } = require("../utils/retry");
const { RetryableError, NonRetryableError } = require("../utils/errors");
const { safeParseJSON } = require("../utils/json");

// Lazy load OpenAI client to allow dynamic env changes in tests
const getOpenAIClient = () => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); 

const MODEL = "gpt-4.1"; 
const MAX_INPUT_LENGTH = 10000; 

// ---------------------------------------------------------------------
// SYSTEM PROMPT & SCHEMA
// ------------------------
const SYSTEM_PROMPT = `You are a highly accurate resume parsing engine.

STRICT RULES:
* Output ONLY valid JSON.
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

const validateParsedData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Validation failed: data is not an object');
  }

  const requiredKeys = [
    'name', 'email', 'phone', 'location', 'linkedin', 'github', 
    'portfolio', 'summary', 'skills', 'experience', 'education', 
    'projects', 'certifications'
  ];

  for (const key of requiredKeys) {
    if (!(key in data)) {
      throw new Error(`Validation failed: missing required key '${key}'`);
    }
  }

  if (!Array.isArray(data.skills)) {
    throw new Error('Validation failed: skills is not an array');
  }
  if (!Array.isArray(data.experience)) {
    throw new Error('Validation failed: experience is not an array');
  }
  for (const exp of data.experience) {
    if (typeof exp !== 'object') {
      throw new Error('Validation failed: invalid experience entry');
    }
  }
  if (!Array.isArray(data.education)) {
    throw new Error('Validation failed: education is not an array');
  }
  if (!Array.isArray(data.projects)) {
    throw new Error('Validation failed: projects is not an array');
  }
  if (!Array.isArray(data.certifications)) {
    throw new Error('Validation failed: certifications is not an array');
  }
};

const normalizeParsedData = (data) => {
  if (Array.isArray(data.skills)) {
    const normalizedSkills = data.skills
      .filter(s => typeof s === 'string')
      .map(s => s.toLowerCase().trim())
      .filter(s => s !== '');
    return {
      ...data,
      skills: [...new Set(normalizedSkills)]
    };
  }
  return { ...data };
};

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
 * Safely attempts to parse JSON from the LLM response, cleaning markdown wrappers
 * @param {string} textRaw
 * @returns {object}
 */
const safeJsonParse = (textRaw) => {
    let cleanedText = textRaw.trim();
    
    // Remove markdown wrappers (```json)
    if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/(^```json|```)$/g, '').trim();
    }

    try {
        // Attempt 1
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error(`JSON parse failed. Raw LLM response: ${textRaw.substring(0, 500)}`);
        // Fallback: If parsing fails, we let the retry mechanism handle the retry instruction,
        // as manual JSON repair is too complex for a utility function.
        return null;
    }
};


/**
 * Coordinates the call to OpenAI API to structure the data
 * @param {string} cleanedText - The cleaned text from the resume.
 * @param {number} attempt - Current retry attempt number.
 * @returns {Promise<object>} The parsed JSON object.
 */
const callOpenAI = async (cleanedText, attempt) => {
  if (process.env.TEST_MODE === 'true') {
    return {
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
    };
  }

  if (process.env.FORCE_LLM_ERROR === 'true') {
    throw new RetryableError(`Simulated LLM Failure (Attempt ${attempt})`);
  }

  const openai = getOpenAIClient();

  const messageHistory = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Please parse the following resume text and return a single JSON object strictly adhering to the provided schema. Resume Text:\n\n---\n\n${cleanedText}` },
  ];
  
  let response;

  try {
    response = await openai.chat.completions.create({
      model: MODEL,
      messages: messageHistory,
      temperature: 0,
      response_format: { type: "json_object" }, 
    });
  } catch (err) {
    // Catch API errors (rate limits, authentication, service outages)
    throw new RetryableError(`OpenAI API request failed (Attempt ${attempt}): ${err.message}`);
  }

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new RetryableError("OpenAI returned empty content.");
  }

  let parsedJson = safeJsonParse(rawContent);

  if (!parsedJson) {
    // Fail parsing, but let the outer function handle the specific retry instruction.
    const error = new NonRetryableError("JSON parsing failed permanently");
    error.rawContent = rawContent;
    throw error;
  }
  
  return parsedJson;
};


/**
 * Main orchestrating function to parse the resume text using LLM
 * Implements retry logic and fallback instructions.
 * @param {string} cleanedText - The cleaned text extracted from the PDF.
 * @returns {Promise<object>} The final structured data object.
 */
const parseWithLLM = async (cleanedText) => {
    try {
        // Attempt 1: Initial parsing attempt
        let data = await withRetry(
            async (attempt) => {
                return callOpenAI(cleanedText, attempt);
            },
            { maxAttempts: 3, baseDelayMs: 1000 }
        );
        return data;

    } catch (error) {
        // Handle initial failure types
        if (error instanceof NonRetryableError && error.rawContent) {
            // If initial failure is due to malformed JSON/schema, we attempt the fallback.
            try {
                console.log("Attempting LLM fallback: 'Fix JSON' instruction.");
                
                // Retry LLM once with the explicit fix instruction
                const fallbackRawText = `The following JSON is invalid. Fix it to strictly match schema:\n\n${error.rawContent}`;

                const openai = getOpenAIClient();
                const fallbackResponse = await openai.chat.completions.create({
                    model: MODEL,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: fallbackRawText }
                    ],
                    temperature: 0,
                    response_format: { type: "json_object" },
                });

                const fallbackRawContent = fallbackResponse.choices[0]?.message?.content;
                const fallbackData = safeJsonParse(fallbackRawContent);

                if (!fallbackData) {
                    throw new Error("Failed to parse JSON even after the 'fix' instruction.");
                }
                
                return fallbackData;

            } catch (fixError) {
                throw new Error("LLM/Parsing Error: Initial failure and mandated fallback failed. " + fixError.message);
            }
        } else {
            // Re-throw retryable or general errors
            throw error;
        }
    }
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

    // 3. LLM PARSING
    console.log(`[${reqId}] Calling LLM for structured parsing...`);
    const parsedData = await parseWithLLM(cleanedText);

    validateParsedData(parsedData);
    const normalizedData = normalizeParsedData(parsedData);

    // 4. SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      data: normalizedData,
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
    } else if (error.message.includes('Validation failed')) {
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
};
