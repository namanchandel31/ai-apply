const { buildResolverContext } = require("../../../src/domain/applicationStatus/context/buildResolverContext");
const { resolveUiStatus } = require("../../../src/domain/applicationStatus/resolver/resolveUiStatus");
const { UI_STATUS, APPLICATION_STATUS } = require("../../../src/domain/applicationStatus/constants/uiStatuses");

function caps(overrides = {}) {
  const ctx = buildResolverContext({
    applicationStatus: APPLICATION_STATUS.DRAFT,
    reviewReason: null,
    latestProcessJob: null,
    latestSendJob: null,
    retryCount: 0,
    ...overrides,
  });
  return resolveUiStatus(ctx);
}

describe("resolveCapabilities via resolveUiStatus", () => {
  it("processing is pollable, not terminal", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.DRAFT,
      latestProcessJob: { status: "processing", job_type: "ai_process" },
    });
    expect(r.uiStatus).toBe(UI_STATUS.PROCESSING);
    expect(r.pollable).toBe(true);
    expect(r.terminal).toBe(false);
  });

  it("sent is not pollable, terminal", () => {
    const r = caps({ applicationStatus: APPLICATION_STATUS.SENT });
    expect(r.pollable).toBe(false);
    expect(r.terminal).toBe(true);
  });

  it("failed is not pollable, terminal", () => {
    const r = caps({ applicationStatus: APPLICATION_STATUS.FAILED });
    expect(r.pollable).toBe(false);
    expect(r.terminal).toBe(true);
  });

  it("needs_review: pollable false, terminal false, canContinue true", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.NEEDS_REVIEW,
      reviewReason: "missing_contact_email",
    });
    expect(r.uiStatus).toBe(UI_STATUS.NEEDS_REVIEW);
    expect(r.pollable).toBe(false);
    expect(r.terminal).toBe(false);
    expect(r.canContinue).toBe(true);
  });

  it("generated idle is not pollable", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.GENERATED,
      latestProcessJob: { status: "completed", job_type: "ai_process" },
    });
    expect(r.uiStatus).toBe(UI_STATUS.GENERATED);
    expect(r.pollable).toBe(false);
    expect(r.terminal).toBe(false);
  });

  it("dashboard generated rows cannot send from applications table", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.GENERATED,
      latestProcessJob: { status: "completed", job_type: "ai_process" },
      emailSubject: "Hello",
      emailBody: "Body",
      sourcePlatform: "dashboard",
    });
    expect(r.canSend).toBe(false);
  });

  it("extension generated rows can send from applications table when review mode", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.GENERATED,
      latestProcessJob: { status: "completed", job_type: "ai_process" },
      emailSubject: "Hello",
      emailBody: "Body",
      sourcePlatform: "linkedin",
    });
    expect(r.canSend).toBe(true);
  });

  it("sending is pollable", () => {
    const r = caps({
      applicationStatus: APPLICATION_STATUS.GENERATED,
      latestSendJob: { status: "processing", job_type: "send_email" },
    });
    expect(r.uiStatus).toBe(UI_STATUS.SENDING);
    expect(r.pollable).toBe(true);
    expect(r.terminal).toBe(false);
  });
});
