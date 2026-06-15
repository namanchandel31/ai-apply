const {
  isValidApplyMode,
  shouldEnqueueSendAfterGeneration,
} = require("../src/services/applyModeService");

describe("applyModeService", () => {
  it("validates apply modes", () => {
    expect(isValidApplyMode("auto_apply")).toBe(true);
    expect(isValidApplyMode("review_apply")).toBe(true);
    expect(isValidApplyMode("invalid")).toBe(false);
  });

  it("only auto_apply enqueues send after generation", () => {
    expect(shouldEnqueueSendAfterGeneration("auto_apply")).toBe(true);
    expect(shouldEnqueueSendAfterGeneration("review_apply")).toBe(false);
    expect(shouldEnqueueSendAfterGeneration(undefined)).toBe(false);
  });
});
