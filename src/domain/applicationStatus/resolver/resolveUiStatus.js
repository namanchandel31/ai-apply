const { RULES } = require("../rules");
const { resolveCapabilities } = require("../capabilities/resolveCapabilities");
const { UI_STATUS } = require("../constants/uiStatuses");

/**
 * Pure UI status resolution — no DB, no side effects.
 */
function resolveUiStatus(ctx, options = {}) {
  const { debug = false } = options;

  for (const rule of RULES) {
    const uiStatus = rule.run(ctx);
    if (uiStatus) {
      const caps = resolveCapabilities(ctx, uiStatus);
      const result = {
        uiStatus,
        status: ctx.applicationStatus,
        ...caps,
      };
      if (debug) {
        result.resolvedBy = rule.name;
      }
      return result;
    }
  }

  const caps = resolveCapabilities(ctx, UI_STATUS.DRAFT);
  const result = {
    uiStatus: UI_STATUS.DRAFT,
    status: ctx.applicationStatus,
    ...caps,
  };
  if (debug) {
    result.resolvedBy = "fallback";
  }
  return result;
}

module.exports = { resolveUiStatus };
