const crypto = require("crypto");
const { processApplyJob } = require("../services/applyService");
const { logInfo, logError } = require("../utils/logger");

const processApplication = async (req, res) => {
  const reqId = crypto.randomBytes(6).toString("hex");
  const { resumeId, jobDescriptionId } = req.body;

  logInfo("request_start", { reqId, stage: "unknown", source: "apply" });

  if (!resumeId || !jobDescriptionId) {
    return res.status(400).json({ error: "Missing resumeId or jobDescriptionId" });
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 20s")), 20000)
    );

    const result = await Promise.race([
      processApplyJob(resumeId, jobDescriptionId, reqId),
      timeoutPromise
    ]);

    logInfo("request_end", { reqId, stage: "unknown", source: "apply", status: "success" });
    return res.json({ success: true, ...result });
  } catch (error) {
    const statusCode = error.message.includes("timed out") ? 504 : 500;
    const isClientError = error.message === "Resume not found" || error.message === "Job Description not found";
    const finalStatusCode = isClientError ? 404 : statusCode;
    
    logError("request_end", error, { reqId, stage: "unknown", source: "apply", status: "failed" });
    return res.status(finalStatusCode).json({ success: false, error: error.message });
  }
};

module.exports = { processApplication };
