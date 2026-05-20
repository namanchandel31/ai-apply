const fs = require("fs");
const path = require("path");

describe("reconnectLogPolicy", () => {
  it("defines storm aggregation and stable reconnect milestone", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../client/src/services/logging/reconnectLogPolicy.ts"
      ),
      "utf8"
    );
    expect(src).toContain("RECONNECT_STORM");
    expect(src).toContain("SSE_RECONNECTED");
    expect(src).toContain("RECONNECT_BACKOFF");
    expect(src).toContain("minReconnectLogIntervalMs");
    expect(src).toContain("onStableConnected");
  });

  it("sseTransport wires reconnect policy hooks", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../client/src/services/realtime/transport/sseTransport.ts"
      ),
      "utf8"
    );
    expect(src).toContain("createReconnectLogPolicy");
    expect(src).toContain("onReconnectAttempt");
    expect(src).toContain("onStableConnected");
    expect(src).toContain("onBackoff");
  });
});
