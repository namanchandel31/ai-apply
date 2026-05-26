const { verifySupabaseAccessToken } = require("../services/supabaseJwtVerifier");
const { ensureLocalUser, touchLastLogin } = require("../services/userSyncService");
const { logAuthRejected } = require("../services/authObservability");

function unauthorized(res, message, code = "UNAUTHORIZED", reason = code) {
  return res.status(401).json({
    success: false,
    error: message,
    code,
  });
}

function reject(res, { message, code, reason, requestId, path }) {
  logAuthRejected({ reason, code, requestId, path });
  return unauthorized(res, message, code, reason);
}

async function supabaseAuthMiddleware(req, res, next) {
  const requestId = req.requestId;
  const path = req.originalUrl;

  const header = req.headers.authorization;
  if (!header) {
    return reject(res, {
      message: "Missing Authorization header",
      code: "MISSING_AUTH_HEADER",
      reason: "missing_auth_header",
      requestId,
      path,
    });
  }

  if (!header.startsWith("Bearer ")) {
    return reject(res, {
      message: "Authorization header must use Bearer scheme",
      code: "MALFORMED_AUTH_HEADER",
      reason: "malformed_auth_header",
      requestId,
      path,
    });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return reject(res, {
      message: "Bearer token is empty",
      code: "MISSING_AUTH_TOKEN",
      reason: "missing_auth_token",
      requestId,
      path,
    });
  }

  try {
    const claims = await verifySupabaseAccessToken(token, { requestId, path });

    const localUser = await ensureLocalUser(claims);
    await touchLastLogin(localUser.id);

    req.user = {
      id: localUser.id,
      supabaseUserId: localUser.supabase_user_id,
      email: localUser.email,
      fullName: localUser.full_name ?? null,
      avatarUrl: localUser.avatar_url ?? null,
    };

    return next();
  } catch (err) {
    if (err.code === "EMAIL_NOT_VERIFIED") {
      return reject(res, {
        message: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
        reason: "email_not_verified",
        requestId,
        path,
      });
    }
    if (err.code === "LEGACY_USER_PENDING_MANUAL_LINK") {
      logAuthRejected({
        reason: "legacy_user_pending_link",
        code: "LEGACY_USER_PENDING_MANUAL_LINK",
        requestId,
        path,
      });
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_PENDING_MANUAL_LINK",
        internalUserId: err.internalUserId,
      });
    }
    if (err.code === "LEGACY_USER_AMBIGUOUS_EMAIL") {
      logAuthRejected({
        reason: "legacy_user_ambiguous_email",
        code: "LEGACY_USER_AMBIGUOUS_EMAIL",
        requestId,
        path,
      });
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_AMBIGUOUS_EMAIL",
      });
    }
    if (err.code === "MISSING_SUB") {
      return reject(res, {
        message: "Invalid token",
        code: "INVALID_TOKEN",
        reason: "missing_sub",
        requestId,
        path,
      });
    }
    if (err.code === "MISSING_EMAIL") {
      return reject(res, {
        message: "Invalid token",
        code: "INVALID_TOKEN",
        reason: "missing_email",
        requestId,
        path,
      });
    }
    if (err.authReason === "expired") {
      return reject(res, {
        message: "Token expired",
        code: "TOKEN_EXPIRED",
        reason: "expired",
        requestId,
        path,
      });
    }
    if (err.authReason === "wrong_issuer") {
      return reject(res, {
        message: "Invalid token issuer",
        code: "INVALID_ISSUER",
        reason: "wrong_issuer",
        requestId,
        path,
      });
    }
    if (err.authReason === "wrong_audience") {
      return reject(res, {
        message: "Invalid token audience",
        code: "INVALID_AUDIENCE",
        reason: "wrong_audience",
        requestId,
        path,
      });
    }
    if (err.authReason === "invalid_signature" || err.authReason === "malformed_token") {
      return reject(res, {
        message: "Invalid token",
        code: "INVALID_TOKEN",
        reason: err.authReason,
        requestId,
        path,
      });
    }
    return reject(res, {
      message: "Unauthorized",
      code: "UNAUTHORIZED",
      reason: err.authReason || "verification_failed",
      requestId,
      path,
    });
  }
}

module.exports = supabaseAuthMiddleware;
