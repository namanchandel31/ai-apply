const { UI_STATUS, APPLICATION_STATUS } = require("../constants/uiStatuses");

function resolveReviewState(ctx) {
  if (
    ctx.applicationStatus === APPLICATION_STATUS.NEEDS_REVIEW &&
    ctx.reviewReason
  ) {
    return UI_STATUS.NEEDS_REVIEW;
  }
  return null;
}

module.exports = resolveReviewState;
