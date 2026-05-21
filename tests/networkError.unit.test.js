const { isBenignNetworkError } = require("../src/observability/networkError");

describe("isBenignNetworkError", () => {
  it("treats ECONNRESET as benign", () => {
    const err = new Error("read ECONNRESET");
    err.code = "ECONNRESET";
    expect(isBenignNetworkError(err)).toBe(true);
  });

  it("treats AbortError (fetch timeout) as benign", () => {
    const err = new Error("This operation was aborted");
    err.name = "AbortError";
    err.code = 20;
    expect(isBenignNetworkError(err)).toBe(true);
  });

  it("treats connection terminated unexpectedly as benign", () => {
    expect(
      isBenignNetworkError(new Error("Connection terminated unexpectedly"))
    ).toBe(true);
  });
});
