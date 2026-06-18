/**
 * Display reconciliation: monotonic updatedAt for role/company merges.
 * Logic mirrored from client/src/queries/applicationsCache.ts shouldApplyDisplayPatch.
 */
function shouldApplyDisplayPatch(existing, incoming) {
  if (!existing?.updatedAt) return true;
  if (!incoming.updatedAt) return false;
  return incoming.updatedAt >= existing.updatedAt;
}

function shouldInsertNewRowIntoList(params, row) {
  if (params.page !== 1) return false;
  if (params.q?.trim()) return false;
  if (params.datePreset) return false;
  if (params.status?.length) {
    const appStatus = (row.status || "").toLowerCase();
    const allowed = params.status.map((s) => s.toLowerCase());
    if (!allowed.includes(appStatus)) return false;
  }
  return true;
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

describe("shouldInsertNewRowIntoList", () => {
  it("matches application_status filters, not uiStatus alone", () => {
    const params = { page: 1, pageSize: 20, status: ["draft"] };
    expect(
      shouldInsertNewRowIntoList(params, {
        status: "draft",
        uiStatus: "processing",
      })
    ).toBe(true);
    expect(
      shouldInsertNewRowIntoList(params, {
        status: "generated",
        uiStatus: "generated",
      })
    ).toBe(false);
  });
});
