const {
  handleUncaughtError,
  markBootPhaseComplete,
  startRuntimeDiagnostics,
  resetRuntimeDiagnosticsForTests,
  collectRuntimeDiagnostics,
} = require("../src/observability/processLifecycle");

jest.mock("../src/utils/logger", () => ({
  logger: { warn: jest.fn(), fatal: jest.fn() },
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock("../src/observability/orchestrationMetrics", () => ({
  metrics: { increment: jest.fn(), gauge: jest.fn() },
}));

jest.mock("../src/config", () => ({
  server: { isProduction: false },
  queue: { workerDeploymentMode: () => "combined", shouldRunInlineWorkers: () => false },
}));

describe("handleUncaughtError", () => {
  const exit = process.exit;

  beforeEach(() => {
    process.exit = jest.fn();
    markBootPhaseComplete();
  });

  afterEach(() => {
    process.exit = exit;
  });

  it("contains connection terminated unexpectedly", () => {
    const err = new Error("Connection terminated unexpectedly");
    handleUncaughtError(err, "test");
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("exits on TypeError", () => {
    const err = new TypeError("Cannot read property 'x' of undefined");
    handleUncaughtError(err, "test");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe("startRuntimeDiagnostics", () => {
  const { logInfo } = require("../src/utils/logger");

  beforeEach(() => {
    resetRuntimeDiagnosticsForTests();
    logInfo.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    resetRuntimeDiagnosticsForTests();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("runs in non-production", async () => {
    jest.spyOn(
      require("../src/observability/processLifecycle"),
      "collectRuntimeDiagnostics"
    ).mockResolvedValue({ redisConnected: true, activeWorkers: "combined" });

    startRuntimeDiagnostics(30000);
    await Promise.resolve();
    expect(logInfo).toHaveBeenCalledWith(
      "RUNTIME_DIAGNOSTICS",
      expect.any(Object)
    );
  });

  it("does not start in production", () => {
    jest.isolateModules(() => {
      jest.doMock("../src/config", () => ({
        server: { isProduction: true },
      }));
      jest.doMock("../src/utils/logger", () => ({
        logger: { warn: jest.fn(), fatal: jest.fn() },
        logError: jest.fn(),
        logInfo: jest.fn(),
      }));
      const { logInfo: prodLog } = require("../src/utils/logger");
      const {
        startRuntimeDiagnostics: startProd,
        resetRuntimeDiagnosticsForTests: resetProd,
      } = require("../src/observability/processLifecycle");
      resetProd();
      startProd(30000);
      jest.advanceTimersByTime(60_000);
      expect(prodLog).not.toHaveBeenCalledWith(
        "RUNTIME_DIAGNOSTICS",
        expect.anything()
      );
    });
  });
});

