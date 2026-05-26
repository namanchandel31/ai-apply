/**
 * Paginated list response normalization (mirrors client/src/lib/applicationsListResponse.ts).
 */
function normalizeApplicationsListData(data) {
  const EMPTY = {
    items: [],
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 20,
  };
  if (data == null) return { ...EMPTY };
  if (Array.isArray(data)) {
    const pageSize = data.length > 0 ? data.length : 20;
    return {
      items: data,
      totalItems: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      currentPage: 1,
      pageSize,
    };
  }
  if (typeof data === "object" && data !== null && "items" in data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const pageSize = data.pageSize ?? 20;
    const totalItems = data.totalItems ?? items.length;
    const totalPages =
      data.totalPages ?? (totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / pageSize)));
    return {
      items,
      totalItems,
      totalPages,
      currentPage: data.currentPage ?? 1,
      pageSize,
    };
  }
  return { ...EMPTY };
}

describe("normalizeApplicationsListData", () => {
  it("returns empty paginated shape for null", () => {
    const r = normalizeApplicationsListData(null);
    expect(r.items).toEqual([]);
    expect(r.totalItems).toBe(0);
    expect(r.pageSize).toBe(20);
  });

  it("coerces legacy flat array", () => {
    const r = normalizeApplicationsListData([{ id: "a" }, { id: "b" }]);
    expect(r.items).toHaveLength(2);
    expect(r.totalItems).toBe(2);
    expect(r.totalPages).toBe(1);
  });

  it("normalizes paginated API response", () => {
    const r = normalizeApplicationsListData({
      items: [{ id: "x" }],
      totalItems: 42,
      totalPages: 3,
      currentPage: 2,
      pageSize: 20,
    });
    expect(r.items).toHaveLength(1);
    expect(r.totalItems).toBe(42);
    expect(r.currentPage).toBe(2);
  });

  it("guards missing items array on paginated object", () => {
    const r = normalizeApplicationsListData({
      items: undefined,
      totalItems: 5,
      totalPages: 1,
      currentPage: 1,
      pageSize: 20,
    });
    expect(r.items).toEqual([]);
    expect(r.totalItems).toBe(5);
  });
});
