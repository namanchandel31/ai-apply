const fs = require("fs");
const path = require("path");
const { mapBundleRow, STATUS_BUNDLE_SQL } = require("../src/models/applicationModel");
const queryService = require("../src/services/applicationStatusQueryService");

describe("getApplicationStatusBundle", () => {
  it("STATUS_BUNDLE_SQL lives in applicationStatusQueryService", () => {
    expect(queryService.STATUS_BUNDLE_SQL).toBe(STATUS_BUNDLE_SQL);
    expect(queryService.getApplicationStatusBundle).toBeDefined();
  });

  it("STATUS_BUNDLE_SQL uses single query with LATERAL joins", () => {
    expect(STATUS_BUNDLE_SQL).toContain("LEFT JOIN LATERAL");
    expect(STATUS_BUNDLE_SQL).toMatch(/job_type = 'ai_process'/);
    expect(STATUS_BUNDLE_SQL).toMatch(/job_type = 'send_email'/);
    expect(STATUS_BUNDLE_SQL).not.toContain("job_descriptions");
  });

  it("controller routes status poll through fast-path helper", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/controllers/applicationController.js"),
      "utf8"
    );
    const block = src.slice(
      src.indexOf("getApplicationStatusController"),
      src.indexOf("const continueApplicationController")
    );
    expect(block).toContain("getApplicationStatusForPoll");
    expect(block).toContain("getApplicationStatusBundle");
    expect(block).toContain("getApplicationStatusSnapshot");
    expect(block).not.toContain("getLatestJobsForApplication");
    expect(block).toContain("orchestration.poll.not_modified");
    expect(src).toContain("logStatusPollEvent");
    expect(src).toContain("STATUS_POLL_CRITICAL");
    expect(src).toContain("orchestrationDedupe");
  });

  it("mapBundleRow maps jobs for serializeApplication", () => {
    const bundle = mapBundleRow({
      id: "app-1",
      application_status: "generated",
      review_reason: null,
      retry_count: 1,
      last_error: null,
      created_at: new Date(),
      updated_at: new Date(),
      sent_at: null,
      completed_at: null,
      process_job_id: "pj-1",
      process_job_status: "completed",
      process_job_created_at: new Date(),
      process_job_updated_at: new Date(),
      process_job_last_error: null,
      process_job_retry_count: 0,
      send_job_id: null,
      send_job_status: null,
      send_job_created_at: null,
      send_job_updated_at: null,
      send_job_last_error: null,
      send_job_retry_count: null,
    });
    expect(bundle.row.id).toBe("app-1");
    expect(bundle.jobs.processJob.status).toBe("completed");
    expect(bundle.jobs.sendJob).toBeNull();
  });
});
