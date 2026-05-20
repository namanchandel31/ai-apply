const { UI_STATUS } = require("../constants/uiStatuses");

function resolveDraftState(ctx) {
  if (ctx.isDraft) {
    return UI_STATUS.DRAFT;
  }
  return UI_STATUS.DRAFT;
}

module.exports = resolveDraftState;
