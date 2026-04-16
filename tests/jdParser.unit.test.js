"use strict";

jest.mock("openai");

const OpenAI = require("openai");
const { NonRetryableError } = require("../src/utils/errors");

// ---------------------------------------------------------------------------
// Helper — builds the response shape the service expects
// ---------------------------------------------------------------------------
const makeOpenAIResponse = (jsonPayload) => ({
  output: [
    {
      content: [
        {
          type: "output_text",
          text: typeof jsonPayload === "string" ? jsonPayload : JSON.stringify(jsonPayload),
        },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Setup mock before each test
// ---------------------------------------------------------------------------
let mockCreate;

beforeEach(() => {
  jest.clearAllMocks();

  mockCreate = jest.fn();

  OpenAI.mockImplementation(() => ({
    responses: { create: mockCreate },
  }));

  // Re-require service AFTER mock is in place so it picks up the mocked client
  jest.resetModules();
});

const getService = () => require("../src/services/jdParserService");

// ---------------------------------------------------------------------------
// 1. Valid structured JD
// ---------------------------------------------------------------------------
describe("parseJobDescription — valid input", () => {
  it("returns correctly parsed output for a full JD", async () => {
    const payload = {
      job_title: "Flutter Developer",
      company_name: "Acme Corp",
      contact_person: "Jane Doe",
      location: "New York, NY",
      contact_email: "jane@acme.com",
      contact_number: "+1 212 555 0100",
      job_type: "Remote",
      skills: ["Flutter", "Dart", "Firebase"],
    };

    mockCreate.mockResolvedValue(makeOpenAIResponse(payload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("We are hiring a Flutter Developer at Acme Corp.");

    expect(result.job_title).toBe("Flutter Developer");
    expect(result.company_name).toBe("Acme Corp");
    expect(result.contact_person).toBe("Jane Doe");
    expect(result.location).toBe("New York, NY");
    expect(result.contact_email).toBe("jane@acme.com");
    expect(result.contact_number).toBe("+1 212 555 0100");
    expect(result.job_type).toBe("Remote");
    expect(result.skills).toEqual(["flutter", "dart", "firebase"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Missing fields → null
// ---------------------------------------------------------------------------
describe("parseJobDescription — missing fields", () => {
  it("returns null for missing optional fields", async () => {
    const payload = {
      job_title: "Backend Engineer",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: null,
      skills: [],
    };

    mockCreate.mockResolvedValue(makeOpenAIResponse(payload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Backend Engineer role.");

    expect(result.company_name).toBeNull();
    expect(result.contact_person).toBeNull();
    expect(result.location).toBeNull();
    expect(result.contact_email).toBeNull();
    expect(result.contact_number).toBeNull();
    expect(result.job_type).toBeNull();
    expect(result.skills).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Invalid JSON from OpenAI → retry logic triggered
// ---------------------------------------------------------------------------
describe("parseJobDescription — invalid JSON triggers retry", () => {
  it("retries on malformed JSON and succeeds on a later attempt", async () => {
    const validPayload = {
      job_title: "Designer",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: null,
      skills: [],
    };

    // First call returns broken JSON; second call returns valid response
    mockCreate
      .mockResolvedValueOnce(makeOpenAIResponse("NOT VALID JSON }{"))
      .mockResolvedValueOnce(makeOpenAIResponse(validPayload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Senior Designer needed.");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.job_title).toBe("Designer");
  });

  it("throws after exhausting all retries on persistent bad JSON", async () => {
    mockCreate.mockResolvedValue(makeOpenAIResponse("INVALID JSON EVERY TIME }{"));

    const { parseJobDescription } = getService();
    await expect(parseJobDescription("Some JD text.")).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
  });
});

// ---------------------------------------------------------------------------
// 4. Schema validation failure → NonRetryableError (no additional retries)
// ---------------------------------------------------------------------------
describe("parseJobDescription — schema validation failure", () => {
  it("throws NonRetryableError without retrying when schema is invalid", async () => {
    // job_type value is not in the allowed enum
    const badPayload = {
      job_title: "Engineer",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: "FullTime", // invalid enum value
      skills: [],
    };

    mockCreate.mockResolvedValue(makeOpenAIResponse(badPayload));

    const { parseJobDescription } = getService();
    await expect(parseJobDescription("Some JD.")).rejects.toThrow(NonRetryableError);

    // Must NOT retry on schema failure
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Skills normalization
// ---------------------------------------------------------------------------
describe("parseJobDescription — skills normalization", () => {
  it("lowercases, trims, and deduplicates skills", async () => {
    const payload = {
      job_title: "Mobile Dev",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: null,
      skills: ["Flutter", " flutter ", "Dart"],
    };

    mockCreate.mockResolvedValue(makeOpenAIResponse(payload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Mobile developer with Flutter and Dart.");

    expect(result.skills).toEqual(["flutter", "dart"]);
  });
});

// ---------------------------------------------------------------------------
// 6. Invalid email and phone → converted to null
// ---------------------------------------------------------------------------
describe("parseJobDescription — invalid contact fields", () => {
  it("nullifies invalid email and phone number", async () => {
    const payload = {
      job_title: "PM",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: "not-an-email",
      contact_number: "abc",
      job_type: null,
      skills: [],
    };

    mockCreate.mockResolvedValue(makeOpenAIResponse(payload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Product Manager position.");

    expect(result.contact_email).toBeNull();
    expect(result.contact_number).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Empty input → throws validation error immediately
// ---------------------------------------------------------------------------
describe("parseJobDescription — empty input", () => {
  it("throws for empty string", async () => {
    const { parseJobDescription } = getService();
    await expect(parseJobDescription("")).rejects.toThrow(
      "parseJobDescription: rawText must be a non-empty string"
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws for whitespace-only string", async () => {
    const { parseJobDescription } = getService();
    await expect(parseJobDescription("   ")).rejects.toThrow(
      "parseJobDescription: rawText must be a non-empty string"
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws for null input", async () => {
    const { parseJobDescription } = getService();
    await expect(parseJobDescription(null)).rejects.toThrow(
      "parseJobDescription: rawText must be a non-empty string"
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
