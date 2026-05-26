const { verifySupabaseAccessToken } = require("../services/supabaseJwtVerifier");
const { ensureLocalUser, touchLastLogin } = require("../services/userSyncService");

function unauthorized(res, message, code = "UNAUTHORIZED") {
  return res.status(401).json({
    success: false,
    error: message,
    code,
  });
}

async function supabaseAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return unauthorized(res, "Unauthorized");
  }

  const token = header.slice(7).trim();
  if (!token) {
    return unauthorized(res, "Unauthorized");
  }

  try {
    const claims = await verifySupabaseAccessToken(token, {
      requestId: req.requestId,
      path: req.originalUrl,
    });

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
      return unauthorized(res, "Email not verified", "EMAIL_NOT_VERIFIED");
    }
    if (err.code === "LEGACY_USER_PENDING_MANUAL_LINK") {
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_PENDING_MANUAL_LINK",
        internalUserId: err.internalUserId,
      });
    }
    if (err.code === "LEGACY_USER_AMBIGUOUS_EMAIL") {
      return res.status(403).json({
        success: false,
        error: err.message,
        code: "LEGACY_USER_AMBIGUOUS_EMAIL",
      });
    }
    if (err.authReason === "expired") {
      return unauthorized(res, "Token expired", "TOKEN_EXPIRED");
    }
    if (err.authReason === "wrong_issuer") {
      return unauthorized(res, "Invalid token issuer", "INVALID_ISSUER");
    }
    if (err.authReason === "wrong_audience") {
      return unauthorized(res, "Invalid token audience", "INVALID_AUDIENCE");
    }
    if (err.authReason === "invalid_signature" || err.authReason === "malformed_token") {
      return unauthorized(res, "Invalid token", "INVALID_TOKEN");
    }
    return unauthorized(res, "Unauthorized");
  }
}

module.exports = supabaseAuthMiddleware;
