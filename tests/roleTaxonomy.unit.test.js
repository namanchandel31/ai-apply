const { normalizeRoleTitle } = require("../src/domain/jd/roleTaxonomy");

describe("roleTaxonomy", () => {
  it("maps flutter developers alias to canonical", () => {
    const r = normalizeRoleTitle("Flutter Developers");
    expect(r.canonical).toBe("Flutter Developer");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("maps nodejs developer variants", () => {
    expect(normalizeRoleTitle("nodejs developer").canonical).toBe("Node.js Developer");
    expect(normalizeRoleTitle("node developer").canonical).toBe("Node.js Developer");
  });

  it("maps ai/ml engineers", () => {
    expect(normalizeRoleTitle("AI/ML Engineers").canonical).toBe("AI/ML Engineer");
  });
});
