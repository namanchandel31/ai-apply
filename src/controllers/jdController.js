const { parseJobDescription } = require("../services/jdParserService");
const { createJDWithParsedData } = require("../models/jdModel");

const uploadJDController = async (req, res) => {
  const reqId = req.requestId || 'UNKNOWN';

  try {
    const { text, title } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain a non-empty 'text' field",
      });
    }

    console.log(`[${reqId}] Parsing Job Description...`);
    
    // Call the JD Parsing service
    // Service handles: Retry logic, LLM calling, Zod schema validation, normalization
    const parsedData = await parseJobDescription(text);

    console.log(`[${reqId}] Persisting parsed JD...`);
    let dbResult;
    try {
      dbResult = await createJDWithParsedData(title || null, text, parsedData);
    } catch (dbErr) {
      console.error(`[${reqId}] DB Persistence Error:`, dbErr.message);
      return res.status(500).json({
        success: false,
        message: "Failed to store JD data",
      });
    }

    return res.status(200).json({
      success: true,
      jobDescriptionId: dbResult.jobDescriptionId,
      parsedJobDescriptionId: dbResult.parsedJobDescriptionId,
      data: parsedData,
      message: "Job description processed and stored successfully",
    });
  } catch (error) {
    console.error(`[${reqId}] [CRITICAL_ERROR]`, error);
    
    let status = 500;
    let message = 'Failed to process job description due to internal error.';

    if (error.name === "NonRetryableError" || error.message.includes("Schema validation")) {
      status = 400;
      message = error.message;
    } else if (error.name === "RetryableError" || error.message.includes("parseJobDescription:")) {
      status = 400;
      message = error.message;
    }

    return res.status(status).json({
      success: false,
      message: message,
    });
  }
};

module.exports = {
  uploadJDController,
};
