const { logInfo } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

function logAuthVerifyFailed({ reason, requestId, path, userId, supabaseUserId }) {
  logInfo(
    "AUTH_VERIFY_FAILED",
    buildLogContext({
      reason,
      requestId,
      path,
      userId,
      supabaseUserId,
      component: "auth",
    })
  );
}

function logAuthEmailRejected({
  requestId,
  path,
  supabaseUserId,
  emailVerifiedClaim,
  hasEmailConfirmedAt,
  providers,
  oauthProviderMatch,
}) {
  logInfo(
    "AUTH_EMAIL_REJECTED",
    buildLogContext({
      requestId,
      path,
      supabaseUserId,
      emailVerifiedClaim,
      hasEmailConfirmedAt,
      providers,
      oauthProviderMatch,
      component: "auth",
    })
  );
}

function logAuthSyncFailed({ supabaseUserId, requestId, errorClass }) {
  logInfo(
    "AUTH_SYNC_FAILED",
    buildLogContext({
      supabaseUserId,
      requestId,
      errorClass,
      component: "auth",
    })
  );
}

module.exports = {
  logAuthVerifyFailed,
  logAuthEmailRejected,
  logAuthSyncFailed,
};
