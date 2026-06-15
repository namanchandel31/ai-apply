const VALID_APPLY_MODES = new Set(["auto_apply", "review_apply"]);

function isValidApplyMode(value) {
  return VALID_APPLY_MODES.has(value);
}

/**
 * Whether the process worker should enqueue send_email after reaching generated.
 */
function shouldEnqueueSendAfterGeneration(applyMode) {
  return applyMode === "auto_apply";
}

module.exports = {
  VALID_APPLY_MODES,
  isValidApplyMode,
  shouldEnqueueSendAfterGeneration,
};
