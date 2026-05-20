const { UI_STATUS, APPLICATION_STATUS } = require("../constants/uiStatuses");

function resolveTerminalState(ctx) {
  if (ctx.applicationStatus === APPLICATION_STATUS.SENT || ctx.isSent) {
    return UI_STATUS.SENT;
  }
  if (ctx.applicationStatus === APPLICATION_STATUS.CANCELLED || ctx.isCancelled) {
    return UI_STATUS.CANCELLED;
  }
  return null;
}

module.exports = resolveTerminalState;
