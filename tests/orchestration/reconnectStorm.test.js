const fs = require("fs");
const path = require("path");

describe("reconnect storm bounds", () => {
  it("uses capped backoff steps and jitter in sseTransport", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../client/src/services/realtime/transport/sseTransport.ts"),
      "utf8"
    );
    expect(src).toContain("BACKOFF_STEPS = [1000, 2000, 5000, 10000, 30000]");
    expect(src).toContain("JITTER_MAX_MS = 500");
    expect(src).toMatch(/Math\.min\(backoffIndex, BACKOFF_STEPS\.length - 1\)/);
  });
});
