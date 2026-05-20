const { UI_STATUS, APPLICATION_STATUS, JOB_STATUS } = require("../constants/uiStatuses");

function resolveRetryState(ctx) {
  if (
    ctx.latestProcessJobStatus === JOB_STATUS.RETRYING ||
    ctx.latestSendJobStatus === JOB_STATUS.RETRYING
  ) {
    return UI_STATUS.RETRYING;
  }
  if (
    ctx.applicationStatus === APPLICATION_STATUS.FAILED &&
    (ctx.hasActiveProcessJob || ctx.hasActiveSendJob)
  ) {
    return UI_STATUS.RETRYING;
  }
  return null;
}

module.exports = resolveRetryState;
