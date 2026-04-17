require('dotenv').config();
const request = require('supertest');
const app = require('../index');

/**
 * Helper to generate a minimal valid PDF buffer containing actual text.
 * Uses a base64-encoded PDF that pdf-parse (or the fallback extractor)
 * can decode into > 50 characters, satisfying the cleanedText length gate.
 */
const buildValidPdfBuffer = () => {
  const base64Pdf = "JVBERi0xLjcKCjEgMCBvYmogICUKPDwvVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCgoyIDAgb2JqCjw8L1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCgozIDAgb2JqCjw8L1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PC9Gb250IDw8L0YxIDUgMCBSPj4+Pgo+PgplbmRvYmoKCjQgMCBvYmoKPDwvTGVuZ3RoIDU1Pj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgoxMCAxMDAgVGQKKEhlbGxvIHdvcmxkLCB0aGlzIGlzIGEgdGVzdCBwZGYgdG8gbWFrZSBzdXJlIGl0IGhhcyBlbm91Z2ggdGV4dCB0byBwYXNzKSBUagoKMTAgNTAgVGQKKG1pbmFjaGFydGFjdGVycyBvdGFzdGVkKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE2IDAwMDAwIG4gCjAwMDAwMDAyMTQgMDAwMDAgbiAKMDAwMDAwMDMyMiAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzkxCiUlRU9GCg==";
  return Buffer.from(base64Pdf, 'base64');
};

describe('POST /api/upload-resume Integration Tests', () => {
  jest.setTimeout(40000);

  const pdfBuffer = buildValidPdfBuffer();

  // Guarantee env isolation: any flags set during a test are always cleaned up,
  // even if the test throws before reaching its manual cleanup line.
  afterEach(() => {
    delete process.env.TEST_MODE;
    delete process.env.FORCE_LLM_ERROR;
  });

  // ---------------------------------------------------------------
  // SUCCESS: Full pipeline with deterministic TEST_MODE mock
  // ---------------------------------------------------------------
  it('should parse resume successfully (TEST_MODE)', async () => {
    process.env.TEST_MODE = 'true';

    const response = await request(app)
      .post('/api/upload-resume')
      .attach('resume', pdfBuffer, 'resume.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);

    // Validate full schema structure returned by the pipeline
    expect(response.body.data).toEqual(expect.objectContaining({
      name: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      location: expect.any(String),
      summary: expect.any(String),
      skills: expect.any(Array),
      experience: expect.any(Array),
      education: expect.any(Array),
      projects: expect.any(Array),
      certifications: expect.any(Array),
    }));

    // Since TEST_MODE returns a known deterministic payload, assert exact values
    // to prove the data passes through validation + normalization without mutation
    expect(response.body.data.name).toBe('John Doe');
    expect(response.body.data.email).toBe('john@example.com');
    expect(response.body.data.skills).toEqual(['javascript', 'node.js']);
  });

  // ---------------------------------------------------------------
  // FAILURE: Invalid file type (not a PDF)
  // ---------------------------------------------------------------
  it('should return 400 for invalid file type', async () => {
    const textBuffer = Buffer.from('This is a plain text file, not a valid PDF document.');

    const response = await request(app)
      .post('/api/upload-resume')
      .attach('resume', textBuffer, 'invalid.txt');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: expect.any(String),
    }));
  });

  // ---------------------------------------------------------------
  // FAILURE: No file attached at all
  // ---------------------------------------------------------------
  it('should return 400 when no file is attached', async () => {
    const response = await request(app)
      .post('/api/upload-resume')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  // ---------------------------------------------------------------
  // FAILURE: LLM error simulation via FORCE_LLM_ERROR
  // ---------------------------------------------------------------
  it('should handle LLM failure gracefully (FORCE_LLM_ERROR)', async () => {
    process.env.FORCE_LLM_ERROR = 'true';

    const response = await request(app)
      .post('/api/upload-resume')
      .attach('resume', pdfBuffer, 'resume.pdf');

    // RetryableError exhaustion maps to 500 in the controller
    expect(response.status).toBe(500);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Simulated LLM Failure'),
    }));
  });

  // ---------------------------------------------------------------
  // RATE LIMIT: Sequential requests with early break on 429
  // ---------------------------------------------------------------
  it('should return 429 when rate limit exceeded', async () => {
    // Rate limiter allows max 20 requests per minute per IP.
    // Send lightweight invalid-type payloads sequentially to avoid
    // triggering real LLM calls while still exhausting the limiter.
    const textBuffer = Buffer.from('dummy data payload');

    let rateLimitHit = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post('/api/upload-resume')
        .attach('resume', textBuffer, 'invalid.txt');

      if (res.status === 429) {
        rateLimitHit = true;
        break;
      }
    }

    expect(rateLimitHit).toBe(true);
  });
});
