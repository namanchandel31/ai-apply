"use strict";

// ---------------------------------------------------------------------------
// mockCreate must be declared before jest.mock() so the factory closes over
// the stable reference. jest.resetModules() only clears the module registry;
// the factory and mockCreate survive across test resets.
// ---------------------------------------------------------------------------
const mockCreate = jest.fn();

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      create: mockCreate,
    },
  }));
});

// Eliminate real sleep delays in withRetry so retry tests finish instantly
// and the full maxAttempts cycle completes without timing issues.
jest.mock("../src/utils/retry", () => {
  const actual = jest.requireActual("../src/utils/retry");
  return {
    ...actual,
    withRetry: (fn, opts) => actual.withRetry(fn, { ...opts, baseDelayMs: 0 }),
  };
});

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
// Reset mock state and module registry before each test so the service always
// gets a fresh OpenAI instance using the still-registered mock factory.
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockCreate.mockReset();
  jest.resetModules();
});

// getService() re-requires the service after resetModules so it uses a fresh
// OpenAI instance that still points to our mockCreate via the jest.mock factory.
const getService = () => require("../src/services/jdParserService");

// NonRetryableError must be loaded from the same module instance that the
// service will use (after the most recent resetModules call).
const getNonRetryableError = () => require("../src/utils/errors").NonRetryableError;

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

    // 1st call → invalid JSON text; 2nd call → valid response
    mockCreate
      .mockResolvedValueOnce(makeOpenAIResponse("NOT VALID JSON }{"))
      .mockResolvedValueOnce(makeOpenAIResponse(validPayload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Senior Designer needed.");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.job_title).toBe("Designer");
  });

  it("throws after exhausting all retries on persistent bad JSON", async () => {
    // Every call returns unparseable text so all 3 attempts fail
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
    const NonRetryableError = getNonRetryableError();

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

// ---------------------------------------------------------------------------
// 8. Retry on OpenAI failure (network/timeout)
// ---------------------------------------------------------------------------
describe("parseJobDescription — OpenAI failure retry logic", () => {
  it("retries on OpenAI network or timeout failure", async () => {
    const validPayload = {
      job_title: "Developer",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: null,
      skills: [],
    };

    // 1st call → network error (triggers RetryableError); 2nd call → valid response
    mockCreate
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(makeOpenAIResponse(validPayload));

    const { parseJobDescription } = getService();
    const result = await parseJobDescription("Looking for a developer.");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.job_title).toBe("Developer");
  });
});

// ---------------------------------------------------------------------------
// 9. Input truncation test
// ---------------------------------------------------------------------------
describe("parseJobDescription — input truncation", () => {
  it("truncates large inputs before sending to OpenAI", async () => {
    const validPayload = {
      job_title: "Engineer",
      company_name: null,
      contact_person: null,
      location: null,
      contact_email: null,
      contact_number: null,
      job_type: null,
      skills: [],
    };

    mockCreate.mockResolvedValueOnce(makeOpenAIResponse(validPayload));

    const { parseJobDescription } = getService();

    // Create string > 5000 chars
    const largeInput = "A".repeat(5050);
    await parseJobDescription(largeInput);

    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.input.find((m) => m.role === "user");

    expect(userMessage.content.length).toBeLessThanOrEqual(5000);
  });
});

// ---------------------------------------------------------------------------
// 10. Defensive skills & empty string normalization (pure util tests)
// ---------------------------------------------------------------------------
const { normalizeSkills, nullifyEmpty } = require("../src/utils/normalise");

describe("normalizeSkills — defensive handling", () => {
  it("safely handles invalid types without crashing", () => {
    const result = normalizeSkills(["Flutter", 123, null]);
    expect(result).toEqual(["flutter"]);
  });
});

describe("nullifyEmpty — empty string handling", () => {
  it("converts empty and whitespace strings to null", () => {
    expect(nullifyEmpty("")).toBeNull();
    expect(nullifyEmpty("   ")).toBeNull();
    // Valid values remain unchanged
    expect(nullifyEmpty("Valid")).toBe("Valid");
  });
});
