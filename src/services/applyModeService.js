const VALID_APPLY_MODES = new Set(["auto_apply", "review_apply"]);

/** Applications submitted from the dashboard Apply composer. */
const DASHBOARD_SOURCE_PLATFORM = "dashboard";

function isValidApplyMode(value) {
  return VALID_APPLY_MODES.has(value);
}

function isDashboardSubmission(sourcePlatform) {
  return sourcePlatform === DASHBOARD_SOURCE_PLATFORM;
}

/**
 * Whether the process worker should enqueue send_email after reaching generated.
 * - auto_apply: always send after generation
 * - review_apply + dashboard: user clicked Send on dashboard — send immediately
 * - review_apply + email at create time: user reviewed copy before queueing (dashboard)
 * - review_apply + extension/LinkedIn: stop at Email Ready for applications-tab review
 *
 * `userProvidedEmail` must reflect email fields on the application row **before**
 * the worker generates copy — after generation every application has subject/body.
 */
function shouldEnqueueSendAfterGeneration(
  applyMode,
  { userProvidedEmail = false, dashboardIntent = false } = {}
) {
  if (applyMode === "auto_apply") return true;
  if (dashboardIntent || userProvidedEmail) return true;
  return false;
}

/** Resolve enqueue flags from the application row at worker start (pre-generation). */
function resolveSendEnqueueFlags(applicationRow) {
  return {
    dashboardIntent: isDashboardSubmission(applicationRow?.source_platform),
    userProvidedEmail: Boolean(
      applicationRow?.email_subject?.trim() && applicationRow?.email_body?.trim()
    ),
  };
}

module.exports = {
  VALID_APPLY_MODES,
  DASHBOARD_SOURCE_PLATFORM,
  isValidApplyMode,
  isDashboardSubmission,
  shouldEnqueueSendAfterGeneration,
  resolveSendEnqueueFlags,
};
