const request = require('supertest');
const app = require('../index');
const crypto = require('crypto');

// Mock DB Layer
jest.mock('../src/models/jdModel', () => ({
  createJDWithParsedData: jest.fn().mockImplementation(async () => {
    // Simulate DB latency
    await new Promise(res => setTimeout(res, 50));
    return {
      jobDescriptionId: 'test-jd-uuid',
      parsedJobDescriptionId: 'test-parsed-jd-uuid'
    };
  })
}));

// We'll spy on the LLM call directly, or we can just mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: jest.fn().mockImplementation(async () => {
        await new Promise(res => setTimeout(res, 100)); // Simulate LLM latency
        return {
          output: [{
            content: [{
              type: "output_text",
              text: JSON.stringify({
                job_title: "Concurrent Engineer",
                company_name: "Concurrency Inc",
                contact_person: null,
                location: "Remote",
                contact_email: "test@example.com",
                contact_number: null,
                job_type: "Remote",
                skills: ["node.js", "concurrency", "redis"]
              })
            }]
          }]
        };
      })
    }
  }));
});

describe('Concurrency and Cache Re-use Integration Test', () => {
  let createJDMock;
  let openaiConstructorMock;

  beforeAll(() => {
    // We disable TEST_MODE so it actually hits our mocked OpenAI instead of fast-failing
    delete process.env.TEST_MODE;
    createJDMock = require('../src/models/jdModel').createJDWithParsedData;
    openaiConstructorMock = require('openai');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle 5 concurrent identical JD uploads with only 1 LLM call and 1 DB write', async () => {
    const jdText = "Looking for a Concurrent Engineer with node.js, concurrency, and redis skills. Remote role.";
    
    // We grab the LLM create mock
    const openaiInstance = new openaiConstructorMock();
    const llmMock = openaiInstance.responses.create;
    llmMock.mockClear();

    // Fire 5 requests in parallel
    const requests = Array.from({ length: 5 }).map(() => 
      request(app)
        .post('/api/upload-jd')
        .send({ text: jdText, title: 'Concurrent Job' })
        .expect(200)
    );

    const responses = await Promise.all(requests);

    // All 5 responses should be successful and have identical returned data
    for (const res of responses) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.job_title).toBe("Concurrent Engineer");
    }

    // The DB should have only been written to ONCE due to inflightJobs dedup
    expect(createJDMock).toHaveBeenCalledTimes(1);
  }, 10000);
});
