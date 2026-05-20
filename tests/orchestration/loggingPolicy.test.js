const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");

describe("orchestration logging policy", () => {
  it("does not emit per-packet SSE_EVENT_SENT at INFO", () => {
    const gateway = fs.readFileSync(
      path.join(root, "src/realtime/sseGateway.js"),
      "utf8"
    );
    const bridge = fs.readFileSync(
      path.join(root, "src/realtime/redisRealtimeBridge.js"),
      "utf8"
    );
    expect(gateway).not.toContain('logInfo("SSE_EVENT_SENT"');
    expect(bridge).not.toContain('logInfo("SSE_EVENT_SENT"');
    expect(gateway).toContain("orchestration.sse.event_sent");
  });

  it("uses DEBUG scope allowlist in logging.config.js", () => {
    const src = fs.readFileSync(
      path.join(root, "src/config/logging.config.js"),
      "utf8"
    );
    expect(src).toContain("orchestration");
    expect(src).toContain("isOrchestrationDebugEnabled");
    const debugFlags = fs.readFileSync(
      path.join(root, "src/utils/debugFlags.js"),
      "utf8"
    );
    expect(debugFlags).not.toContain("DEBUG_ORCHESTRATION_REALTIME");
  });

  it("removes routine STATUS_POLL info logs from controller", () => {
    const src = fs.readFileSync(
      path.join(root, "src/controllers/applicationController.js"),
      "utf8"
    );
    expect(src).not.toContain('logInfo("STATUS_POLL"');
    expect(src).not.toContain('logInfo("STATUS_POLL_NOT_MODIFIED"');
    expect(src).toContain("orchestrationDedupe");
  });

  it("reconciliation diagnostics avoid console.debug", () => {
    const src = fs.readFileSync(
      path.join(
        root,
        "client/src/services/realtime/reconciliation/reconciliationDiagnostics.ts"
      ),
      "utf8"
    );
    expect(src).not.toContain("console.debug");
    expect(src).not.toContain("EVENT_APPLIED");
    expect(src).toContain("logWarnDeduped");
    expect(src).toContain("metrics.increment");
  });

  it("sseTransport uses reconnectLogPolicy", () => {
    const src = fs.readFileSync(
      path.join(root, "client/src/services/realtime/transport/sseTransport.ts"),
      "utf8"
    );
    expect(src).toContain("createReconnectLogPolicy");
    expect(src).toContain("onStableConnected");
  });
});
