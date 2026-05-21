const {
  handleUncaughtError,
  markBootPhaseComplete,
} = require("../src/observability/processLifecycle");

jest.mock("../src/utils/logger", () => ({
  logger: { warn: jest.fn(), fatal: jest.fn() },
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock("../src/observability/orchestrationMetrics", () => ({
  metrics: { increment: jest.fn() },
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
