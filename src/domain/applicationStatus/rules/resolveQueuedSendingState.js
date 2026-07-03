const { UI_STATUS, APPLICATION_STATUS } = require("../constants/uiStatuses");
const { SEND_QUEUE_ENTRY_STATUS } = require("../../../constants/schedulerState");

function resolveQueuedSendingState(ctx) {
  if (ctx.applicationStatus !== APPLICATION_STATUS.GENERATED) {
    return null;
  }
  if (ctx.hasActiveSendJob) {
    return null;
  }
  if (ctx.sendQueueStatus === SEND_QUEUE_ENTRY_STATUS.WAITING) {
    return UI_STATUS.QUEUED_SENDING;
  }
  return null;
}

module.exports = resolveQueuedSendingState;
