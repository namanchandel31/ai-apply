const { resolveUiStatus } = require("../../../src/domain/applicationStatus/resolver/resolveUiStatus");
const { buildResolverContext } = require("../../../src/domain/applicationStatus/context/buildResolverContext");
const { UI_STATUS, APPLICATION_STATUS } = require("../../../src/domain/applicationStatus/constants/uiStatuses");

function ctx(overrides = {}) {
  return buildResolverContext({
    applicationStatus: APPLICATION_STATUS.DRAFT,
    reviewReason: null,
    latestProcessJob: null,
    latestSendJob: null,
    retryCount: 0,
    ...overrides,
  });
}

describe("resolveUiStatus", () => {
  it("returns sent for terminal sent status", () => {
    const r = resolveUiStatus(ctx({ applicationStatus: APPLICATION_STATUS.SENT }));
    expect(r.uiStatus).toBe(UI_STATUS.SENT);
    expect(r.terminal).toBe(true);
    expect(r.pollable).toBe(false);
  });

  it("returns needs_review when business status is needs_review", () => {
    const r = resolveUiStatus(
      ctx({
        applicationStatus: APPLICATION_STATUS.NEEDS_REVIEW,
        reviewReason: "missing_contact_email",
      })
    );
    expect(r.uiStatus).toBe(UI_STATUS.NEEDS_REVIEW);
    expect(r.canContinue).toBe(true);
  });

  it("returns processing when ai_process job is active", () => {
    const r = resolveUiStatus(
      ctx({
        applicationStatus: APPLICATION_STATUS.DRAFT,
        latestProcessJob: { status: "processing", job_type: "ai_process" },
      })
    );
    expect(r.uiStatus).toBe(UI_STATUS.PROCESSING);
    expect(r.pollable).toBe(true);
  });

  it("returns queued when send_email job is queued", () => {
    const r = resolveUiStatus(
      ctx({
        applicationStatus: APPLICATION_STATUS.GENERATED,
        latestSendJob: { status: "queued", job_type: "send_email" },
      })
    );
    expect(r.uiStatus).toBe(UI_STATUS.QUEUED);
    expect(r.pollable).toBe(true);
  });

  it("returns sending when send_email job is processing", () => {
    const r = resolveUiStatus(
      ctx({
        applicationStatus: APPLICATION_STATUS.GENERATED,
        latestSendJob: { status: "processing", job_type: "send_email" },
      })
    );
    expect(r.uiStatus).toBe(UI_STATUS.SENDING);
    expect(r.pollable).toBe(true);
  });

  it("returns failed for business failed status", () => {
    const r = resolveUiStatus(ctx({ applicationStatus: APPLICATION_STATUS.FAILED }));
    expect(r.uiStatus).toBe(UI_STATUS.FAILED);
    expect(r.canRetry).toBe(true);
    expect(r.terminal).toBe(true);
  });

  it("returns generated when idle after AI", () => {
    const r = resolveUiStatus(
      ctx({
        applicationStatus: APPLICATION_STATUS.GENERATED,
        latestProcessJob: { status: "completed", job_type: "ai_process" },
      })
    );
    expect(r.uiStatus).toBe(UI_STATUS.GENERATED);
  });
});
