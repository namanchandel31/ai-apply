const { UI_STATUS, TERMINAL_UI_STATUSES, APPLICATION_STATUS } = require("../constants/uiStatuses");
const { isDashboardSubmission } = require("../../../services/applyModeService");

const ACTIVE_POLL_UI = new Set([
  UI_STATUS.PROCESSING,
  UI_STATUS.SENDING,
  UI_STATUS.QUEUED,
  UI_STATUS.RETRYING,
]);

/**
 * Lifecycle capability flags for API + frontend polling.
 *
 * terminal:
 *   true  => automated execution lifecycle is fully complete (no further worker automation).
 *   false => workflow may still continue (e.g. human continue after needs_review).
 *
 * needs_review: pollable=false, terminal=false — automation paused, resumable via continue.
 *
 * Do NOT confuse terminal with "business workflow closed" — use application_status for that.
 *
 * failed disambiguation:
 *   applications.application_status = failed  → workflow-level failure (see failureSemantics.js)
 *   application_jobs.status = failed          → one execution attempt failed (append-only history)
 */
function resolveCapabilities(ctx, uiStatus) {
  const terminal =
    TERMINAL_UI_STATUSES.has(uiStatus) ||
    ctx.applicationStatus === APPLICATION_STATUS.SENT ||
    ctx.applicationStatus === APPLICATION_STATUS.CANCELLED;

  const pollable =
    !terminal &&
    uiStatus !== UI_STATUS.NEEDS_REVIEW &&
    ctx.applicationStatus !== APPLICATION_STATUS.NEEDS_REVIEW &&
    (ctx.hasActiveProcessJob ||
      ctx.hasActiveSendJob ||
      ACTIVE_POLL_UI.has(uiStatus));

  const canContinue =
    ctx.applicationStatus === APPLICATION_STATUS.NEEDS_REVIEW &&
    Boolean(ctx.reviewReason);

  const canRetry =
    ctx.applicationStatus === APPLICATION_STATUS.FAILED &&
    !ctx.hasCompletedSendJob &&
    ctx.applicationStatus !== APPLICATION_STATUS.CANCELLED;

  const canSend =
    ctx.applicationStatus === APPLICATION_STATUS.GENERATED &&
    Boolean(ctx.emailSubject?.trim()) &&
    Boolean(ctx.emailBody?.trim()) &&
    !ctx.hasActiveSendJob &&
    !isDashboardSubmission(ctx.sourcePlatform);

  return { terminal, pollable, canContinue, canRetry, canSend };
}

module.exports = { resolveCapabilities };
