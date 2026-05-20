const {
  buildStatusFingerprint,
  computeStatusEtag,
  etagMatches,
} = require("../src/services/applicationStatusEtag");

describe("applicationStatusEtag", () => {
  const row = {
    application_status: "generated",
    review_reason: null,
    retry_count: 0,
    updated_at: new Date("2026-05-19T12:00:00.000Z"),
    process_job_status: "completed",
    process_job_updated_at: new Date("2026-05-19T12:01:00.000Z"),
    send_job_status: null,
    send_job_updated_at: null,
  };

  it("produces stable etag for same fingerprint", () => {
    const fp = buildStatusFingerprint(row);
    const a = computeStatusEtag(fp);
    const b = computeStatusEtag(fp);
    expect(a).toBe(b);
    expect(a).toMatch(/^W\/"/);
  });

  it("changes etag when job status changes", () => {
    const fp1 = buildStatusFingerprint(row);
    const fp2 = buildStatusFingerprint({ ...row, process_job_status: "processing" });
    expect(computeStatusEtag(fp1)).not.toBe(computeStatusEtag(fp2));
  });

  it("etagMatches accepts quoted header values", () => {
    const etag = computeStatusEtag(buildStatusFingerprint(row));
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(`${etag}, W/"other"`, etag)).toBe(true);
  });
});
