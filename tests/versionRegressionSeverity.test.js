const {
  surfaceRegression,
  classifyClientStale,
  REPEATED_THRESHOLD,
} = require("../src/utils/versionRegression");
const { logDebug, logError } = require("../src/utils/logger");
const { orchestrationDedupe } = require("../src/utils/logDedupe");

jest.mock("../src/utils/debugFlags", () => ({
  isDebugEnabled: jest.fn(() => true),
}));

jest.mock("../src/utils/logger", () => ({
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

describe("versionRegression severity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("harmless replay surfaces as debug when reconciliation debug enabled", () => {
    const result = surfaceRegression({
      regressionType: "harmless_replay",
      applicationId: "a1",
      staleBy: "version",
      replayDetected: true,
      repeatedCount: 1,
    });
    expect(result.severity).toBe("debug");
    expect(logDebug).toHaveBeenCalledWith(
      "VERSION_REGRESSION_DEBUG",
      expect.objectContaining({ regressionType: "harmless_replay" }),
      "reconciliation"
    );
  });

  it("repeated stale records deduped warn bucket", () => {
    const recordSpy = jest.spyOn(orchestrationDedupe, "record");
    surfaceRegression({
      regressionType: "repeated_stale",
      applicationId: "a1",
      staleBy: "epoch",
      repeatedCount: REPEATED_THRESHOLD,
    });
    expect(recordSpy).toHaveBeenCalledWith(
      "warn",
      "VERSION_REGRESSION_DETECTED",
      expect.stringContaining("a1"),
      expect.any(Object)
    );
    recordSpy.mockRestore();
  });

  it("monotonic violation logs error immediately", () => {
    const result = surfaceRegression({
      regressionType: "monotonic_violation",
      applicationId: "a1",
      staleBy: "version",
    });
    expect(result.severity).toBe("error");
    expect(logError).toHaveBeenCalledWith(
      "VERSION_REGRESSION_FATAL",
      expect.any(Error),
      expect.objectContaining({ regressionType: "monotonic_violation" })
    );
  });

  it("classifyClientStale escalates after threshold", () => {
    const appId = "classify-test";
    let last;
    for (let i = 0; i < REPEATED_THRESHOLD; i++) {
      last = classifyClientStale({ applicationId: appId, staleBy: "version" });
    }
    expect(last.regressionType).toBe("repeated_stale");
    expect(last.severity).toBe("warn");
  });
});
