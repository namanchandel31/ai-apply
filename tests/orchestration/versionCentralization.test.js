const fs = require("fs");
const path = require("path");

describe("version centralization", () => {
  it("does not export public bump helpers from orchestrationVersion", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../src/services/orchestrationVersion.js"),
      "utf8"
    );
    expect(src).not.toMatch(/^\s*bumpOrchestrationEpoch,/m);
    expect(src).not.toMatch(/^\s*incrementOrchestrationVersion,/m);
  });

  it("applicationCommandService does not call bumpOrchestrationEpoch directly", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../src/services/applicationCommandService.js"),
      "utf8"
    );
    expect(src).not.toContain("bumpOrchestrationEpoch");
    expect(src).toContain('orchestrationBump: "revive_with_transition"');
    expect(src).toContain('orchestrationBump: "revive"');
  });

  it("transition layer reports monotonic violations via versionRegression", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../src/services/orchestrationVersion.js"),
      "utf8"
    );
    expect(src).toContain("reportMonotonicViolation");
  });
});
