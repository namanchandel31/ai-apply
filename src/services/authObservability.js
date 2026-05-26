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

function logAuthVerifyDebug(ctx) {
  logInfo(
    "AUTH_VERIFY_DEBUG",
    buildLogContext({
      ...ctx,
      component: "auth",
    })
  );
}

function logAuthRejected({ reason, requestId, path, code, phase }) {
  logInfo(
    "AUTH_REJECTED",
    buildLogContext({
      reason,
      code,
      requestId,
      path,
      phase,
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
  userMetadataEmailVerified,
  providers,
  oauthProviderMatch,
  oauthAmr,
}) {
  logInfo(
    "AUTH_EMAIL_REJECTED",
    buildLogContext({
      requestId,
      path,
      supabaseUserId,
      emailVerifiedClaim,
      hasEmailConfirmedAt,
      userMetadataEmailVerified,
      providers,
      oauthProviderMatch,
      oauthAmr,
      component: "auth",
    })
  );
}

function logAuthSyncFailed({ supabaseUserId, requestId, path, errorClass, pgCode }) {
  logInfo(
    "AUTH_SYNC_FAILED",
    buildLogContext({
      supabaseUserId,
      requestId,
      path,
      errorClass,
      pgCode,
      component: "auth",
    })
  );
}

function logAuthConfigReady({ issuer, jwksHost, audience }) {
  logInfo(
    "AUTH_CONFIG_READY",
    buildLogContext({
      issuer,
      jwksHost,
      audience,
      component: "auth",
    })
  );
}

module.exports = {
  logAuthVerifyFailed,
  logAuthVerifyDebug,
  logAuthRejected,
  logAuthEmailRejected,
  logAuthSyncFailed,
  logAuthConfigReady,
};
