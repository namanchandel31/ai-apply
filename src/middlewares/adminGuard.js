const { getUserById } = require("../models/userModel");
const { logError } = require("../utils/logger");

/**
 * Authorizes admin-only actions using the DB `users.is_admin` flag.
 * Toggle the flag directly in the database to grant/revoke access.
 *
 * Responds with 404 (not 403) for non-admins so the feature stays hidden.
 * Requires `supabaseAuthMiddleware` to have populated `req.user.id` first.
 */
async function adminGuard(req, res, next) {
  try {
    const user = await getUserById(req.user?.id);
    if (user?.is_admin === true) {
      return next();
    }
  } catch (err) {
    logError("ADMIN_GUARD_ERROR", err, { userId: req.user?.id, reqId: req.requestId });
  }
  return res.status(404).json({ success: false, error: "Not found" });
}

module.exports = adminGuard;
