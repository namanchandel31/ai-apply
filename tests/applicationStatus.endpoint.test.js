const fs = require("fs");
const path = require("path");

describe("getApplicationStatusController", () => {
  it("uses bundle query instead of getApplicationById or dual job fetches", () => {
    const controllerPath = path.join(
      __dirname,
      "../src/controllers/applicationController.js"
    );
    const src = fs.readFileSync(controllerPath, "utf8");
    const fnStart = src.indexOf("const getApplicationStatusController");
    const fnEnd = src.indexOf("const continueApplicationController");
    const block = src.slice(fnStart, fnEnd);
    expect(block).toContain("getApplicationStatusBundle");
    expect(block).not.toContain("getApplicationById");
    expect(block).not.toContain("getLatestJobsForApplication");
    expect(block).toContain("orchestration.poll.not_modified");
    expect(src).toContain("logStatusPollEvent");
    expect(src).toContain("STATUS_POLL_SLOW");
    expect(src).toContain("orchestrationDedupe");
    expect(block).toContain("ETag");
  });

  it("exports getApplicationStatusSnapshot from query service via model", () => {
    const modelPath = path.join(__dirname, "../src/models/applicationModel.js");
    const queryPath = path.join(
      __dirname,
      "../src/services/applicationStatusQueryService.js"
    );
    const modelSrc = fs.readFileSync(modelPath, "utf8");
    const querySrc = fs.readFileSync(queryPath, "utf8");
    expect(modelSrc).toContain("applicationStatusQueryService");
    expect(querySrc).toMatch(
      /SELECT id, application_status, review_reason, retry_count/
    );
  });
});
