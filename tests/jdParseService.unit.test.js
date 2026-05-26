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
      roles: ["Engineer"],
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
    expect(data.parseOutcome).toBeDefined();
    expect(data.parseArtifacts).toBeDefined();
  });

  it("enriches informal multi-role post when LLM returns null title", async () => {
    generateStructuredJson.mockResolvedValue({
      job_title: null,
      roles: [],
      company_name: null,
      skills: [],
      contact_email: null,
      contact_number: null,
      contact_person: null,
      location: null,
      job_type: null,
    });

    const raw = `Open Positions:
• Flutter Developers
• AI/ML Engineers`;

    const data = await parseJobDescription(raw, "user-1", {
      resumeSkills: ["Flutter", "Dart"],
    });

    expect(data.job_title).toBe("Flutter Developer");
    expect(data.skills.length).toBeGreaterThan(0);
    expect(data.parseArtifacts.selection.selectedRole).toBe("Flutter Developer");
  });

  it("throws NonRetryableError for garbage content", async () => {
    generateStructuredJson.mockResolvedValue({
      job_title: null,
      roles: [],
      company_name: null,
      skills: [],
      contact_email: null,
      contact_number: null,
      contact_person: null,
      location: null,
      job_type: null,
    });

    await expect(parseJobDescription("asdf qwerty zxcv", "user-1")).rejects.toMatchObject({
      name: "NonRetryableError",
      code: "invalid_parsed_content",
      retryable: false,
      validation: expect.objectContaining({
        hasUsableContent: false,
      }),
    });
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
    const failureCounter = Object.entries(snap.counters).find(
      ([k]) => k.startsWith("orchestration.jd_parse.failure") && k.includes("retryable=true")
    );
    expect(failureCounter?.[1]).toBe(1);
  });
});
