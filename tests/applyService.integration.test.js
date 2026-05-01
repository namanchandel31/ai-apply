require("dotenv").config();
const { pool } = require("../src/db");
const { processApplyJob } = require("../src/services/applyService");
const { createResumeWithParsedData } = require("../src/models/resumeModel");
const { createJDWithParsedData } = require("../src/models/jdModel");

// Mock the email service to avoid OpenAI calls
jest.mock("../src/services/emailService", () => ({
  generateApplicationEmail: jest.fn().mockResolvedValue({
    subject: "Application for Software Engineer",
    body: "Here is my application body focusing on react and node."
  }),
  RetryableError: class RetryableError extends Error {
    constructor(msg) {
      super(msg);
      this.name = "RetryableError";
    }
  }
}));

const { generateApplicationEmail } = require("../src/services/emailService");

describe("Apply Service Integration", () => {
  let resumeId;
  let jdId;

  beforeAll(async () => {
    // Insert a dummy resume
    const res = await createResumeWithParsedData(
      "test_resume.pdf",
      1024,
      `hash_${Date.now()}`,
      "Raw text for test resume",
      { name: "John Doe", email: "john@example.com", skills: ["react", "node"] }
    );
    resumeId = res.resumeId;

    // Insert a dummy JD
    const jd = await createJDWithParsedData(
      "Software Engineer",
      "Raw text for test JD",
      { job_title: "Software Engineer", skills: ["react", "aws"] }
    );
    jdId = jd.jobDescriptionId;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM applications WHERE resume_id = $1", [resumeId]);
    await pool.query("DELETE FROM resumes WHERE id = $1", [resumeId]);
    await pool.query("DELETE FROM job_descriptions WHERE id = $1", [jdId]);
    await pool.end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should generate a new application email and save to DB", async () => {
    const result = await processApplyJob(resumeId, jdId, "req_1");

    expect(result.applicationId).toBeDefined();
    expect(result.match.score).toBe(50); // react matches, aws missing
    expect(result.email.subject).toBe("Application for Software Engineer");
    
    expect(generateApplicationEmail).toHaveBeenCalledTimes(1);
  });

  it("should bypass generation if application already exists (duplicate check)", async () => {
    // This second call should instantly hit the deduplication check
    const result = await processApplyJob(resumeId, jdId, "req_2");

    expect(result.applicationId).toBeDefined();
    expect(result.match.score).toBe(50);
    // Should NOT call the email generator again
    expect(generateApplicationEmail).toHaveBeenCalledTimes(0);
  });

});
