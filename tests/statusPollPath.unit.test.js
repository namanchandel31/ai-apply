const fs = require("fs");
const path = require("path");

describe("status poll terminal fast path", () => {
  it("routes terminal apps through snapshot helper", () => {
    const pollSrc = fs.readFileSync(
      path.join(__dirname, "../src/services/applicationStatusForPoll.js"),
      "utf8"
    );
    expect(pollSrc).toContain("getApplicationStatusSnapshot");
    expect(pollSrc).toContain('fastPath: "terminal"');

    const controllerSrc = fs.readFileSync(
      path.join(__dirname, "../src/controllers/applicationController.js"),
      "utf8"
    );
    expect(controllerSrc).toContain('fastPath === "terminal"');
    expect(controllerSrc).toContain("orchestration.poll.duration_ms");
    expect(controllerSrc).toContain("getApplicationStatusForPoll");
  });
});
