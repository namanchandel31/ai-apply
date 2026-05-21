/**
 * Display reconciliation: monotonic updatedAt for role/company merges.
 * Logic mirrored from client/src/queries/applicationsCache.ts shouldApplyDisplayPatch.
 */
function shouldApplyDisplayPatch(existing, incoming) {
  if (!existing?.updatedAt) return true;
  if (!incoming.updatedAt) return false;
  return incoming.updatedAt >= existing.updatedAt;
}

describe("shouldApplyDisplayPatch", () => {
  it("rejects older updatedAt so stale SSE cannot overwrite newer role", () => {
    const existing = {
      updatedAt: "2026-05-20T12:00:00.000Z",
      role: "Senior Engineer",
      company: "Acme",
    };
    const incoming = {
      updatedAt: "2026-05-20T11:00:00.000Z",
      role: "Junior Engineer",
      company: "Other",
    };
    expect(shouldApplyDisplayPatch(existing, incoming)).toBe(false);
  });

  it("accepts equal or newer updatedAt", () => {
    const existing = { updatedAt: "2026-05-20T12:00:00.000Z", role: "A" };
    expect(
      shouldApplyDisplayPatch(existing, {
        updatedAt: "2026-05-20T12:00:00.000Z",
        role: "B",
      })
    ).toBe(true);
    expect(
      shouldApplyDisplayPatch(existing, {
        updatedAt: "2026-05-20T13:00:00.000Z",
        role: "B",
      })
    ).toBe(true);
  });

  it("requires incoming updatedAt when existing row has one", () => {
    expect(
      shouldApplyDisplayPatch(
        { updatedAt: "2026-05-20T12:00:00.000Z" },
        { role: "X" }
      )
    ).toBe(false);
  });
});
