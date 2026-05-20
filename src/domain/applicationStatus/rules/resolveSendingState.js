const { UI_STATUS, APPLICATION_STATUS, JOB_STATUS } = require("../constants/uiStatuses");

function resolveSendingState(ctx) {
  if (ctx.applicationStatus !== APPLICATION_STATUS.GENERATED) {
    return null;
  }
  if (ctx.latestSendJobStatus === JOB_STATUS.PROCESSING) {
    return UI_STATUS.SENDING;
  }
  if (ctx.latestSendJobStatus === JOB_STATUS.QUEUED) {
    return UI_STATUS.QUEUED;
  }
  if (ctx.hasActiveSendJob) {
    return UI_STATUS.SENDING;
  }
  return null;
}

module.exports = resolveSendingState;
