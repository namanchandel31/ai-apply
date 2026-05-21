const { scoreOpeningStrength } = require("../src/services/emailOpeningStrength");

describe("scoreOpeningStrength", () => {
  it("scores weak generic opener low", () => {
    const r = scoreOpeningStrength({
      body: "I am excited to apply for this position. I have many years of experience.",
      job: { title: "Data Engineer", company: "Acme" },
    });
    expect(r.score).toBeLessThan(50);
    expect(r.weakPatterns.length).toBeGreaterThan(0);
  });

  it("scores role-named opening higher", () => {
    const r = scoreOpeningStrength({
      body: "Hi, I noticed you're hiring a Data Engineer at Acme. My recent work has focused on pipelines.",
      job: { title: "Data Engineer", company: "Acme" },
    });
    expect(r.score).toBeGreaterThan(55);
    expect(r.strengths).toContain("role_named_early");
  });
});
