const {
  isValidApplyMode,
  isDashboardSubmission,
  shouldEnqueueSendAfterGeneration,
  resolveSendEnqueueFlags,
  DASHBOARD_SOURCE_PLATFORM,
} = require("../src/services/applyModeService");

describe("applyModeService", () => {
  it("validates apply modes", () => {
    expect(isValidApplyMode("auto_apply")).toBe(true);
    expect(isValidApplyMode("review_apply")).toBe(true);
    expect(isValidApplyMode("invalid")).toBe(false);
  });

  it("identifies dashboard submissions", () => {
    expect(isDashboardSubmission(DASHBOARD_SOURCE_PLATFORM)).toBe(true);
    expect(isDashboardSubmission("linkedin")).toBe(false);
  });

  it("auto_apply always enqueues send after generation", () => {
    expect(shouldEnqueueSendAfterGeneration("auto_apply")).toBe(true);
  });

  it("review_apply enqueues send for dashboard intent or user email", () => {
    expect(shouldEnqueueSendAfterGeneration("review_apply")).toBe(false);
    expect(
      shouldEnqueueSendAfterGeneration("review_apply", { userProvidedEmail: true })
    ).toBe(true);
    expect(
      shouldEnqueueSendAfterGeneration("review_apply", { dashboardIntent: true })
    ).toBe(true);
    expect(
      shouldEnqueueSendAfterGeneration("review_apply", {
        userProvidedEmail: false,
        dashboardIntent: false,
      })
    ).toBe(false);
  });

  it("resolveSendEnqueueFlags uses create-time row only", () => {
    expect(
      resolveSendEnqueueFlags({
        source_platform: "dashboard",
        email_subject: "Hi",
        email_body: "Body",
      })
    ).toEqual({ dashboardIntent: true, userProvidedEmail: true });

    expect(
      resolveSendEnqueueFlags({
        source_platform: "linkedin",
        email_subject: null,
        email_body: null,
      })
    ).toEqual({ dashboardIntent: false, userProvidedEmail: false });
  });
});
