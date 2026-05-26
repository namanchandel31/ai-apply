const { parseHiringSections } = require("../src/services/jdHiringSectionParser");

describe("jdHiringSectionParser", () => {
  it("extracts roles from Open Positions section", () => {
    const text = `Open Positions:
• Flutter Developers
• AI/ML Engineers
• Data Engineers`;

    const { roleCandidates } = parseHiringSections(text);
    const raws = roleCandidates.map((c) => c.raw);
    expect(raws.some((r) => /flutter/i.test(r))).toBe(true);
    expect(raws.some((r) => /ai\/ml/i.test(r))).toBe(true);
    expect(raws.some((r) => /data engineer/i.test(r))).toBe(true);
  });

  it("does not treat soft skills as roles", () => {
    const text = `Requirements:
• Strong communication skills
• Passion for technology`;

    const { roleCandidates, excludedBullets } = parseHiringSections(text);
    expect(roleCandidates).toHaveLength(0);
    expect(excludedBullets.some((e) => e.reason === "soft_skill")).toBe(true);
  });
});
