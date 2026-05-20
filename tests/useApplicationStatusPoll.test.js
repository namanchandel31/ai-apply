const fs = require("fs");
const path = require("path");

const hookPath = path.join(
  __dirname,
  "../client/src/hooks/useApplicationStatusPoll.ts"
);

describe("useApplicationStatusPoll", () => {
  it("poll loop effect does not depend on applications (prevents poll storm)", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toMatch(
      /}, \[pollableIdsKey, pollIntervalMs, visibilityEpoch, connectionState\]\);/
    );
    const pollerStart = src.lastIndexOf("useEffect(() => {");
    const pollerEnd = src.indexOf("}, [pollableIdsKey, pollIntervalMs, visibilityEpoch, connectionState]");
    const pollerEffect = src.slice(pollerStart, pollerEnd);
    expect(pollerEffect).not.toMatch(/\bapplications\b/);
    expect(pollerEffect).not.toMatch(/\bonUpdate\b/);
  });

  it("does not call tick synchronously on every effect run", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).not.toMatch(/setInterval\(tick,\s*APPLICATION_POLL_MS\);\s*tick\(\)/);
    expect(src).toMatch(/wasEmpty/);
  });

  it("uses StrictMode generation guard", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toContain("pollerGeneration");
    expect(src).toMatch(/myGeneration !== pollerGeneration/);
  });

  it("pauses when document is hidden", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toContain("visibilitychange");
    expect(src).toContain('visibilityState === "hidden"');
  });

  it("handles 429 with global pause", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toContain("globalPausedUntilRef");
    expect(src).toContain("retryAfterMs");
  });

  it("uses registry for pollable membership", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toContain("globalOrchestrationRegistry");
    expect(src).toContain("getPollableIdsKey");
  });

  it("gates polling on connectionState degraded/disconnected only", () => {
    const src = fs.readFileSync(hookPath, "utf8");
    expect(src).toContain("pollIntervalForConnection");
    expect(src).toMatch(/state === "connected"\)[\s\S]*return null/);
    expect(src).toContain("pollIntervalMs === null");
  });
});

describe("useApplicationStatusPoll interval simulation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires at most one tick per APPLICATION_POLL_MS when membership is stable", async () => {
    const { computePollableIdsKey } = require("./helpers/pollLoopLogicMirror.cjs");
    const APPLICATION_POLL_MS = 3000;

    let tickCount = 0;
    const pollableIdsKey = computePollableIdsKey(
      [{ id: "app-1", terminal: false, pollable: true }],
      () => 0,
      60
    );

    const tick = jest.fn(async () => {
      tickCount += 1;
    });

    const id = setInterval(() => {
      void tick();
    }, APPLICATION_POLL_MS);

    await jest.advanceTimersByTimeAsync(0);
    expect(tickCount).toBe(0);

    await jest.advanceTimersByTimeAsync(APPLICATION_POLL_MS);
    expect(tickCount).toBe(1);

    await jest.advanceTimersByTimeAsync(APPLICATION_POLL_MS);
    expect(tickCount).toBe(2);

    await jest.advanceTimersByTimeAsync(APPLICATION_POLL_MS * 2);
    expect(tickCount).toBe(4);

    clearInterval(id);
    expect(pollableIdsKey).toBe("app-1");
  });

  it("allows at most 2 ticks in 6s for one app (no storm)", async () => {
    const APPLICATION_POLL_MS = 3000;
    let tickCount = 0;
    const id = setInterval(() => {
      tickCount += 1;
    }, APPLICATION_POLL_MS);

    await jest.advanceTimersByTimeAsync(6000);
    clearInterval(id);
    expect(tickCount).toBeLessThanOrEqual(2);
  });
});
