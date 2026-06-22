const { shouldEnqueueSendAfterGeneration, resolveSendEnqueueFlags } = require("../src/services/applyModeService");

describe("dashboard send enqueue", () => {
  it("review_apply + dashboard source enqueues send", () => {
    const flags = resolveSendEnqueueFlags({
      source_platform: "dashboard",
      email_subject: "Hello",
      email_body: "Body",
    });
    expect(shouldEnqueueSendAfterGeneration("review_apply", flags)).toBe(true);
  });

  it("review_apply + extension without create-time email waits for review", () => {
    const flags = resolveSendEnqueueFlags({
      source_platform: "linkedin",
      email_subject: null,
      email_body: null,
    });
    expect(shouldEnqueueSendAfterGeneration("review_apply", flags)).toBe(false);
  });

  it("review_apply + extension stays in review even after worker generates email copy", () => {
    const flagsAtWorkerStart = resolveSendEnqueueFlags({
      source_platform: "linkedin",
      email_subject: null,
      email_body: null,
    });
    expect(shouldEnqueueSendAfterGeneration("review_apply", flagsAtWorkerStart)).toBe(false);
  });
});
