/**
 * Recovery SQL must scope to latest job per (application_id, job_type).
 */
describe("recovery ordering queries", () => {
  it("findRecoverableStuckProcessingJobs uses latest-per-type join", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../src/models/applicationJobModel.js"),
      "utf8"
    );
    expect(src).toContain("findRecoverableStuckProcessingJobs");
    expect(src).toMatch(/MAX\(created_at\)/);
    expect(src).toMatch(/latest\.max_created/);
  });

  it("recovery.job uses recoverable query helpers", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../src/jobs/recovery.job.js"),
      "utf8"
    );
    expect(src).toContain("findRecoverableStuckQueuedJobs");
    expect(src).toContain("findRecoverableStuckProcessingJobs");
    expect(src).not.toMatch(/findStuckQueuedJobs\(/);
  });
});
