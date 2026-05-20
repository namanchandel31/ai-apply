const { processApplyJob } = require("../services/applyService");
const { logInfo, logError } = require("../utils/logger");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { buildLogContext } = require("../utils/buildLogContext");

const processApplication = async (req, res) => {
  const reqId = req.requestId || "UNKNOWN";
  const { resumeId, jobDescriptionId } = req.body;

  logInfo("request_start", { reqId, stage: "unknown", source: "apply" });

  if (!resumeId || !jobDescriptionId) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.BAD_REQUEST,
      message: "Missing resumeId or jobDescriptionId",
      retryable: false,
    });
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 20s")), 20000)
    );

    const result = await Promise.race([
      processApplyJob(resumeId, jobDescriptionId, reqId, req.user.id),
      timeoutPromise,
    ]);

    logInfo("request_end", { reqId, stage: "unknown", source: "apply", status: "success" });

    const options = result.idempotent ? { idempotent: true } : {};
    return ok(res, result, options);
  } catch (err) {
    logError(
      "APPLICATION_PROCESSING_FAILED",
      err,
      buildLogContext({
        reqId,
        userId: req.user?.id,
        route: req.originalUrl,
        method: req.method,
      })
    );

    if (err.message === "Resume not found" || err.message === "Job Description not found") {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: err.message === "Resume not found" ? "Resume not found" : "Job description not found",
        retryable: false,
      });
    }

    if (err.message?.includes("timed out")) {
      return sendError(res, {
        status: 504,
        code: "TIMEOUT",
        message: "Request timed out",
        retryable: true,
      });
    }

    return sendError(res, {
      status: 500,
      code: "APPLICATION_PROCESSING_FAILED",
      message: "Failed to process application",
      retryable: true,
    });
  }
};

module.exports = { processApplication };
