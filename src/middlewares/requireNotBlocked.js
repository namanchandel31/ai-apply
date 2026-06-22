const { sendError } = require("../utils/httpErrorResponse");
const { pool } = require("../db");
const { logError } = require("../utils/logger");

async function requireNotBlocked(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT is_blocked, blocked_reason FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (rows[0]?.is_blocked) {
      return sendError(res, {
        status: 403,
        code: "USER_BLOCKED",
        message: rows[0].blocked_reason || "Your account has been suspended",
        retryable: false,
      });
    }
    return next();
  } catch (err) {
    logError("REQUIRE_NOT_BLOCKED_ERROR", err, { userId: req.user?.id });
    return sendError(res, {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Account check failed",
      retryable: true,
    });
  }
}

module.exports = requireNotBlocked;
