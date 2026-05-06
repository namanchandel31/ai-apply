const crypto = require("crypto");
const { processApplyJob } = require("../services/applyService");
const { logInfo, logError } = require("../utils/logger");
const { error, ok, ERROR_CODES } = require("../utils/response");

const processApplication = async (req, res) => {
  const reqId = crypto.randomBytes(6).toString("hex");
  const { resumeId, jobDescriptionId } = req.body;

  logInfo("request_start", { reqId, stage: "unknown", source: "apply" });

  if (!resumeId || !jobDescriptionId) {
    return error(res, 400, "Missing resumeId or jobDescriptionId", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 20s")), 20000)
    );

    const result = await Promise.race([
      processApplyJob(resumeId, jobDescriptionId, reqId, req.user.id),
      timeoutPromise
    ]);

    logInfo("request_end", { reqId, stage: "unknown", source: "apply", status: "success" });
    
    // Add idempotent flag if present in result
    const options = result.idempotent ? { idempotent: true } : {};
    return ok(res, result, options);
  } catch (error) {
    const statusCode = error.message.includes("timed out") ? 504 : 500;
    const isClientError = error.message === "Resume not found" || error.message === "Job Description not found";
    const finalStatusCode = isClientError ? 404 : statusCode;
    
    logError("request_end", error, { reqId, stage: "unknown", source: "apply", status: "failed" });
    
    const errorCode = finalStatusCode === 404 ? ERROR_CODES.NOT_FOUND : 
                      finalStatusCode === 504 ? 'TIMEOUT' : ERROR_CODES.INTERNAL_ERROR;
    
    return error(res, finalStatusCode, error.message, errorCode);
  }
};

module.exports = { processApplication };
