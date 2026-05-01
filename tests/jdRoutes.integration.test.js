require('dotenv').config();
const request = require('supertest');
const app = require('../index');

jest.mock('../src/models/jdModel', () => ({
  createJDWithParsedData: jest.fn().mockResolvedValue({
    jobDescriptionId: 'test-jd-uuid',
    parsedJobDescriptionId: 'test-parsed-jd-uuid'
  })
}));

// Mock the parser service to avoid real API calls
jest.mock('../src/services/jdParserService', () => ({
  parseJobDescription: jest.fn().mockResolvedValue({
    job_title: "Senior React Engineer",
    company_name: null,
    contact_person: null,
    location: "Remote",
    contact_email: "jobs@example.com",
    contact_number: "+1 800 555 1234",
    job_type: "Remote",
    skills: ["react", "node.js", "typescript"]
  })
}));

describe('POST /api/upload-jd Integration Tests', () => {
  jest.setTimeout(40000);

  afterEach(async () => {
    jest.clearAllMocks();
  });

  const validJdText = `
    We are looking for a Senior React Engineer.
    Location: Remote
    Contact: jobs@example.com or +1 800 555 1234
    Skills required: React, Node.js, TypeScript
  `;

  // ---------------------------------------------------------------
  // SUCCESS: Valid JD Text
  // ---------------------------------------------------------------
  it('should parse JD successfully and return IDs', async () => {
    // Using live OpenAI API for JD tests as there's no TEST_MODE for it right now.
    // Ensure we don't break limits.
    const response = await request(app)
      .post('/api/upload-jd')
      .send({
        text: validJdText,
        title: "Senior React Engineer"
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);

    // Validate new persistence response structure
    expect(response.body).toHaveProperty('jobDescriptionId');
    expect(response.body).toHaveProperty('parsedJobDescriptionId');
    expect(typeof response.body.jobDescriptionId).toBe('string');
    expect(typeof response.body.parsedJobDescriptionId).toBe('string');

    // Validate schema structure
    expect(response.body.data).toEqual(expect.objectContaining({
      job_title: expect.any(String),
      location: expect.any(String),
      contact_email: expect.any(String),
      skills: expect.any(Array)
    }));
  });

  // ---------------------------------------------------------------
  // FAILURE: Missing text
  // ---------------------------------------------------------------
  it('should return 400 when no text is provided', async () => {
    const response = await request(app)
      .post('/api/upload-jd')
      .send({
        title: "Missing Text"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('non-empty');
  });

  // ---------------------------------------------------------------
  // FAILURE: Empty string text
  // ---------------------------------------------------------------
  it('should return 400 when text is empty string', async () => {
    const response = await request(app)
      .post('/api/upload-jd')
      .send({
        text: "   "
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
