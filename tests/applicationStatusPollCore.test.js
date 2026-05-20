const {
  computePollableIdsKey,
  shouldPoll,
  computeBackoffMs,
  isAppInBackoff,
  mapWithConcurrency,
} = require("./helpers/pollLoopLogicMirror.cjs");

describe("pollLoopLogic", () => {
  describe("computePollableIdsKey", () => {
    it("is stable when only non-membership fields change", () => {
      const getAttempts = () => 0;
      const base = [
        { id: "b", terminal: false, pollable: true, uiStatus: "processing" },
        { id: "a", terminal: false, pollable: true, uiStatus: "queued" },
      ];
      const key1 = computePollableIdsKey(base, getAttempts, 60);
      const patched = base.map((a) => ({
        ...a,
        uiStatus: a.id === "a" ? "sending" : a.uiStatus,
      }));
      const key2 = computePollableIdsKey(patched, getAttempts, 60);
      expect(key1).toBe("a,b");
      expect(key2).toBe("a,b");
    });

    it("drops terminal apps from the key", () => {
      const apps = [
        { id: "1", terminal: false, pollable: true },
        { id: "2", terminal: true, pollable: false },
      ];
      expect(computePollableIdsKey(apps, () => 0, 60)).toBe("1");
    });
  });

  describe("computeBackoffMs", () => {
    it("doubles up to cap", () => {
      expect(computeBackoffMs(1, 3000, 30000)).toBe(3000);
      expect(computeBackoffMs(2, 3000, 30000)).toBe(6000);
      expect(computeBackoffMs(10, 3000, 30000)).toBe(30000);
    });
  });

  describe("isAppInBackoff", () => {
    it("returns true inside backoff window", () => {
      const now = 10_000;
      expect(isAppInBackoff("x", 2, 5000, now, 3000, 30000)).toBe(true);
    });

    it("returns false after backoff window", () => {
      const now = 20_000;
      expect(isAppInBackoff("x", 2, 5000, now, 3000, 30000)).toBe(false);
    });
  });

  describe("mapWithConcurrency", () => {
    it("runs at most limit workers in parallel", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const items = [1, 2, 3, 4, 5];
      await mapWithConcurrency(items, 2, async (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return n * 2;
      });
      expect(maxInFlight).toBeLessThanOrEqual(2);
    });
  });

  describe("shouldPoll hardened", () => {
    it("rejects sent with pollable true", () => {
      expect(shouldPoll({ pollable: true, uiStatus: "sent" }, 0, 60)).toBe(false);
    });
  });
});
