const { verifySupabaseAccessToken, authReasonToResponseCode } = require("../services/supabaseJwtVerifier");
const { ensureLocalUser, touchLastLogin } = require("../services/userSyncService");
const { logAuthRejected, logAuthSyncFailed } = require("../services/authObservability");
const { logError } = require("../utils/logger");

function unauthorized(res, message, code) {
  return res.status(401).json({
    success: false,
    error: message,
    code,
  });
}

function reject(res, { message, code, reason, requestId, path, phase = "jwt" }) {
  logAuthRejected({ reason, code, requestId, path, phase });
  return unauthorized(res, message, code);
}

function mapJwtErrorToResponse(err, { requestId, path }) {
  if (err.code === "EMAIL_NOT_VERIFIED") {
    return {
      message: "Email not verified",
      code: "EMAIL_NOT_VERIFIED",
      reason: "email_not_verified",
    };
  }
  if (err.code === "MISSING_SUB" || err.code === "MISSING_EMAIL") {
    return {
      message: err.code === "MISSING_EMAIL" ? "Email missing from token" : "Invalid token",
      code: err.code === "MISSING_EMAIL" ? "MISSING_EMAIL" : "INVALID_TOKEN",
      reason: err.code === "MISSING_EMAIL" ? "missing_email" : "missing_sub",
    };
  }
  if (err.authReason) {
    const code = err.code || authReasonToResponseCode(err.authReason);
    const messages = {
      TOKEN_EXPIRED: "Token expired",
      INVALID_ISSUER: "Invalid token issuer",
      INVALID_AUDIENCE: "Invalid token audience",
      INVALID_TOKEN: "Invalid token",
      JWKS_FETCH_FAILED: "Unable to verify token signing keys",
      UNAUTHORIZED: "Unauthorized",
    };
    return {
      message: messages[code] || "Unauthorized",
      code,
      reason: err.authReason,
    };
  }
  return {
    message: "Unauthorized",
    code: "UNAUTHORIZED",
    reason: "verification_failed",
  };
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

  let claims;
  try {
    claims = await verifySupabaseAccessToken(token, { requestId, path });
  } catch (err) {
    if (err.code === "LEGACY_USER_PENDING_MANUAL_LINK") {
      logAuthRejected({
        reason: "legacy_user_pending_link",
        code: "LEGACY_USER_PENDING_MANUAL_LINK",
        requestId,
        path,
        phase: "sync",
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
        phase: "sync",
      });
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_AMBIGUOUS_EMAIL",
      });
    }

    const mapped = mapJwtErrorToResponse(err, { requestId, path });
    return reject(res, { ...mapped, requestId, path, phase: "jwt" });
  }

  try {
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
    if (err.code === "LEGACY_USER_PENDING_MANUAL_LINK") {
      logAuthRejected({
        reason: "legacy_user_pending_link",
        code: "LEGACY_USER_PENDING_MANUAL_LINK",
        requestId,
        path,
        phase: "sync",
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
        phase: "sync",
      });
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_AMBIGUOUS_EMAIL",
      });
    }

    logAuthSyncFailed({
      supabaseUserId: claims.sub,
      requestId,
      path,
      errorClass: err?.name || "Error",
      pgCode: err?.code,
    });
    logError("AUTH_USER_SYNC_ERROR", err, {
      component: "auth",
      requestId,
      path,
      supabaseUserId: claims.sub,
    });

    return res.status(500).json({
      success: false,
      error: "Failed to resolve user account",
      code: "AUTH_USER_SYNC_FAILED",
    });
  }
}

module.exports = supabaseAuthMiddleware;
