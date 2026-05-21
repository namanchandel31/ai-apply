const { scoreRecruiterReadability } = require("../src/services/emailRecruiterReadability");

describe("scoreRecruiterReadability", () => {
  it("penalizes filler-heavy opening before value", () => {
    const r = scoreRecruiterReadability({
      subject: "Role",
      body: [
        "Dear Sir or Madam, I hope this message finds you well. I wanted to reach out regarding opportunities.",
        "",
        "Eventually, the Data Engineer role at Acme might be a fit for my background in pipelines.",
      ].join("\n"),
      job: { title: "Data Engineer", company: "Acme" },
    });
    expect(r.overall).toBeLessThan(65);
  });

  it("rewards early role visibility", () => {
    const r = scoreRecruiterReadability({
      subject: "Data Engineer at Acme",
      body: [
        "Hi, I saw the Data Engineer opening at Acme and wanted to reach out.",
        "",
        "I've spent the last few years on data pipelines and tooling. Resume attached.",
      ].join("\n"),
      job: { title: "Data Engineer", company: "Acme" },
    });
    expect(r.scanSpeed).toBeGreaterThan(55);
  });
});
