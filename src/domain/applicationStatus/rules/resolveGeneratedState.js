const { UI_STATUS, APPLICATION_STATUS } = require("../constants/uiStatuses");

function resolveGeneratedState(ctx) {
  if (ctx.applicationStatus === APPLICATION_STATUS.GENERATED) {
    return UI_STATUS.GENERATED;
  }
  return null;
}

module.exports = resolveGeneratedState;
