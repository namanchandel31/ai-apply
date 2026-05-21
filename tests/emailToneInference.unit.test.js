const { inferToneContext } = require("../src/services/emailToneInference");

describe("inferToneContext", () => {
  it("detects startup signals", () => {
    const ctx = inferToneContext({
      rawJdText: "Join our fast-paced startup. Series A team, equity, wear many hats.",
      parsedJd: { job_type: "Remote" },
    });
    expect(ctx.companyStyle).toBe("startup");
    expect(ctx.environmentType).toBe("remote_first");
  });

  it("detects enterprise signals", () => {
    const ctx = inferToneContext({
      rawJdText: "Global enterprise team. Stakeholder management and compliance required.",
      parsedJd: {},
    });
    expect(ctx.companyStyle).toBe("enterprise");
    expect(ctx.communicationTone).toBe("polished");
  });
});
