jest.mock("../src/services/aiGateway", () => ({
  generateStructuredJson: jest.fn(),
}));

const { generateStructuredJson } = require("../src/services/aiGateway");
const { parseJobDescription } = require("../src/services/jdParseService");
const { RetryableError, NonRetryableError } = require("../src/utils/errors");
const { metrics } = require("../src/observability/orchestrationMetrics");

describe("parseJobDescription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    metrics.reset();
  });

  it("returns parsed JD when title and skills present", async () => {
    generateStructuredJson.mockResolvedValue({
      job_title: "Engineer",
      company_name: "Acme",
      skills: ["react"],
      contact_email: null,
      contact_number: null,
      contact_person: null,
      location: null,
      job_type: "Remote",
    });

    const data = await parseJobDescription("Build react apps at Acme", "user-1", {
      reqId: "r1",
    });
    expect(data.job_title).toBe("Engineer");
    expect(data.skills).toContain("react");
  });

  it("throws NonRetryableError for invalid content without ReferenceError", async () => {
    generateStructuredJson.mockResolvedValue({
      job_title: null,
      company_name: "Acme",
      skills: [],
      contact_email: null,
      contact_number: null,
      contact_person: null,
      location: null,
      job_type: null,
    });

    await expect(
      parseJobDescription("Some job text without parseable fields", "user-1")
    ).rejects.toThrow(NonRetryableError);

    await expect(
      parseJobDescription("Some job text without parseable fields", "user-1")
    ).rejects.toMatchObject({ message: "invalid_parsed_content" });
  });

  it("rethrows RetryableError from gateway unchanged", async () => {
    const retryErr = new RetryableError("rate limited");
    generateStructuredJson.mockRejectedValue(retryErr);

    await expect(parseJobDescription("Job description text here", "user-1")).rejects.toBe(
      retryErr
    );
  });

  it("records retryable metric tag on RetryableError", async () => {
    generateStructuredJson.mockRejectedValue(new RetryableError("timeout"));
    await expect(parseJobDescription("Job text", "user-1")).rejects.toBeInstanceOf(
      RetryableError
    );
    const snap = metrics.getSnapshot();
    expect(snap.counters["orchestration.jd_parse.failure|retryable=true"]).toBe(1);
  });
});
