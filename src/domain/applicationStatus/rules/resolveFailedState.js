const { UI_STATUS, APPLICATION_STATUS, JOB_STATUS } = require("../constants/uiStatuses");

function resolveFailedState(ctx) {
  if (ctx.applicationStatus !== APPLICATION_STATUS.FAILED) {
    return null;
  }
  if (ctx.latestProcessJobStatus === JOB_STATUS.RETRYING) {
    return null;
  }
  if (ctx.latestSendJobStatus === JOB_STATUS.RETRYING) {
    return null;
  }
  if (ctx.hasActiveProcessJob || ctx.hasActiveSendJob) {
    return null;
  }
  return UI_STATUS.FAILED;
}

module.exports = resolveFailedState;
