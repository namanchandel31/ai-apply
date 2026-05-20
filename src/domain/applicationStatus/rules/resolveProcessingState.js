const { UI_STATUS, JOB_STATUS } = require("../constants/uiStatuses");

function resolveProcessingState(ctx) {
  if (ctx.latestProcessJobStatus === JOB_STATUS.PROCESSING) {
    return UI_STATUS.PROCESSING;
  }
  if (ctx.latestProcessJobStatus === JOB_STATUS.QUEUED && ctx.hasActiveProcessJob) {
    return UI_STATUS.QUEUED;
  }
  if (ctx.hasActiveProcessJob && ctx.latestProcessJobStatus !== JOB_STATUS.RETRYING) {
    return UI_STATUS.PROCESSING;
  }
  return null;
}

module.exports = resolveProcessingState;
