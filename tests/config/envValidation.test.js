const fs = require("fs");
const path = require("path");

describe("config env validation", () => {
  it("requireEnv lists missing keys without exit when exitOnMissing false", () => {
    const env = require("../../src/config/env");
    const missing = env.requireEnv(["DEFINITELY_MISSING_XYZ"], { exitOnMissing: false });
    expect(missing).toContain("DEFINITELY_MISSING_XYZ");
  });

  it("parseDebugScopes respects allowlist", () => {
    const prev = process.env.DEBUG;
    process.env.DEBUG = "orchestration,query,llm,invalid_scope";
    jest.resetModules();
    const env = require("../../src/config/env");
    const scopes = env.parseDebugScopes();
    expect(scopes.has("orchestration")).toBe(true);
    expect(scopes.has("query")).toBe(true);
    expect(scopes.has("invalid_scope")).toBe(false);
    process.env.DEBUG = prev;
  });

  it("queue config uses WORKER_MODE env defaulting to separate", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../src/config/queue.config.js"),
      "utf8"
    );
    expect(src).toContain('str("WORKER_MODE", "separate")');
    expect(src).toContain("shouldRunInlineWorkers");
  });
});
