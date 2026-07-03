const { formatNextSendLabel } = require("../../src/services/intelligentSendQueueService");
const { SCHEDULER_STATE } = require("../../src/constants/schedulerState");

describe("intelligentSendQueueService helpers", () => {
  test("formatNextSendLabel returns Paused for paused scheduler", () => {
    expect(
      formatNextSendLabel({
        scheduler_state: SCHEDULER_STATE.PAUSED,
        next_dispatch_at: new Date(),
      })
    ).toBe("Paused");
  });

  test("formatNextSendLabel returns em dash for idle scheduler", () => {
    expect(
      formatNextSendLabel({
        scheduler_state: SCHEDULER_STATE.IDLE,
        next_dispatch_at: null,
      })
    ).toBe("—");
  });

  test("formatNextSendLabel formats active scheduler", () => {
    const label = formatNextSendLabel({
      scheduler_state: SCHEDULER_STATE.ACTIVE,
      next_dispatch_at: new Date(Date.now() + 5 * 60_000),
    });
    expect(label).toMatch(/In \d+ minute/);
  });
});

describe("resolveQueuedSendingState", () => {
  const { buildResolverContext } = require("../../src/domain/applicationStatus/context/buildResolverContext");
  const { resolveUiStatus } = require("../../src/domain/applicationStatus/resolver/resolveUiStatus");

  test("maps waiting queue entry to queued_sending", () => {
    const ctx = buildResolverContext({
      applicationStatus: "generated",
      sendQueueStatus: "waiting",
      emailSubject: "Hi",
      emailBody: "Body",
    });
    const resolved = resolveUiStatus(ctx);
    expect(resolved.uiStatus).toBe("queued_sending");
    expect(resolved.canSendNow).toBe(true);
    expect(resolved.canSend).toBe(false);
  });
});
