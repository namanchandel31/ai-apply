const { RetryableError, NonRetryableError } = require("../src/utils/errors");
const {
  classifyProviderError,
  isProviderJsonValidationFailure,
} = require("../src/providers/providerUtils");

describe("providerUtils JSON error classification", () => {
  it("detects Groq JSON validation failures", () => {
    const err = {
      status: 400,
      message:
        "400 Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
    };
    expect(isProviderJsonValidationFailure(err)).toBe(true);
    const classified = classifyProviderError(err);
    expect(classified).toBeInstanceOf(RetryableError);
    expect(classified.message).toContain("JSON generation failed");
  });

  it("keeps other 400 errors non-retryable", () => {
    const err = { status: 400, message: "Invalid model name" };
    const classified = classifyProviderError(err);
    expect(classified).toBeInstanceOf(NonRetryableError);
  });
});
