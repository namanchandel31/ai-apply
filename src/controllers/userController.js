const { pool } = require('../db');
const { ok, error, ERROR_CODES } = require('../utils/response');
const { logError } = require('../utils/logger');

const getSetupStatusController = async (req, res) => {
  const userId = req.user.id;
  try {
    // Check for active resume
    // In the future, this can be joined with user defaults to get the specifically selected default resume.
    // For now, getting the latest uploaded resume is sufficient.
    const { rows: resumeRows } = await pool.query(
      `SELECT id, file_hash as "fileHash", file_name as "filename", uploaded_at as "uploadedAt"
       FROM resumes 
       WHERE user_id = $1 
       ORDER BY uploaded_at DESC 
       LIMIT 1`,
      [userId]
    );

    // Check for email credentials
    const { rows: credRows } = await pool.query(
      `SELECT email FROM user_email_credentials WHERE user_id = $1`,
      [userId]
    );

    const { rows: aiChainRows } = await pool.query(
      `SELECT id, provider, selected_model as "selectedModel", label, provider_type as "providerType",
              allow_platform_fallback as "allowPlatformFallback", priority,
              health_status as "healthStatus", in_fallback_chain as "inFallbackChain"
       FROM user_ai_credentials WHERE user_id = $1
       ORDER BY priority ASC`,
      [userId]
    );

    const primaryAi = aiChainRows.find((r) => r.priority === 0) || null;

    const hasResume = resumeRows.length > 0;
    const hasEmailSetup = credRows.length > 0;
    const hasAiSetup = aiChainRows.length > 0 || !!process.env.OPENAI_API_KEY;

    return ok(res, {
      hasResume,
      hasEmailSetup,
      hasAiSetup,
      activeResume: hasResume ? resumeRows[0] : null,
      email: hasEmailSetup ? credRows[0].email : null,
      activeAiProvider: primaryAi,
      aiCredentialChain: aiChainRows,
    });
  } catch (err) {
    logError("GET_SETUP_STATUS_ERROR", err, { userId, reqId: req.requestId });
    return error(res, 500, "Failed to fetch setup status", ERROR_CODES.INTERNAL_ERROR);
  }
};

module.exports = {
  getSetupStatusController
};
