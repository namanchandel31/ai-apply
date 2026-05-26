const { logInfo } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

function logAuthVerifyFailed({ reason, requestId, path, userId, supabaseUserId, claim }) {
  logInfo(
    "AUTH_VERIFY_FAILED",
    buildLogContext({
      reason,
      requestId,
      path,
      userId,
      supabaseUserId,
      claim,
      component: "auth",
    })
  );
}

function logAuthRejected({ reason, requestId, path, code }) {
  logInfo(
    "AUTH_REJECTED",
    buildLogContext({
      reason,
      code,
      requestId,
      path,
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

function logAuthConfigReady({ issuer, jwksHost }) {
  logInfo(
    "AUTH_CONFIG_READY",
    buildLogContext({
      issuer,
      jwksHost,
      component: "auth",
    })
  );
}

module.exports = {
  logAuthVerifyFailed,
  logAuthRejected,
  logAuthEmailRejected,
  logAuthSyncFailed,
  logAuthConfigReady,
};
