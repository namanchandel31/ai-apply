const { classifyJdParseFailure, FAILURE_ACTION } = require("../src/services/jdParseFailureClassifier");
const { RetryableError, NonRetryableError } = require("../src/utils/errors");

describe("jdParseFailureClassifier", () => {
  it("classifies RetryableError as retry", () => {
    expect(classifyJdParseFailure(new RetryableError("timeout"))).toBe(FAILURE_ACTION.RETRY);
  });

  it("classifies NonRetryableError as unrecoverable", () => {
    expect(classifyJdParseFailure(new NonRetryableError("invalid_parsed_content"))).toBe(
      FAILURE_ACTION.UNRECOVERABLE
    );
  });
});
