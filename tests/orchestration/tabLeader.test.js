function shouldHoldLease(lease, myTabId, now) {
  if (!lease || lease.expiresAt < now) return true;
  return lease.tabId === myTabId;
}

describe("tab leader lease", () => {
  it("claims when lease expired", () => {
    expect(shouldHoldLease({ tabId: "other", expiresAt: 100 }, "mine", 200)).toBe(true);
  });

  it("holds when already leader", () => {
    expect(shouldHoldLease({ tabId: "mine", expiresAt: 9999 }, "mine", 200)).toBe(true);
  });

  it("yields when another tab holds valid lease", () => {
    expect(shouldHoldLease({ tabId: "other", expiresAt: 9999 }, "mine", 200)).toBe(false);
  });
});
