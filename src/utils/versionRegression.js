const { logDebug, logError } = require("./logger");
const { isDebugEnabled } = require("./debugFlags");
const { orchestrationDedupe } = require("./logDedupe");
const { metrics } = require("../observability/orchestrationMetrics");
const { orchestrationLogContext } = require("./orchestrationLogContext");
const config = require("../config");

const REPEATED_THRESHOLD = config.realtime.VERSION_REGRESSION_WARN_THRESHOLD;
const repeatTrack = new Map();

function classifyClientStale(params) {
  const { applicationId, staleBy, replayDetected = true } = params;
  const key = `${applicationId}:${staleBy}`;
  const entry = repeatTrack.get(key) || { count: 0, firstAt: Date.now() };
  entry.count += 1;
  repeatTrack.set(key, entry);

  const regressionType =
    entry.count >= REPEATED_THRESHOLD ? "repeated_stale" : "harmless_replay";

  return surfaceRegression({
    regressionType,
    applicationId,
    staleBy,
    replayDetected,
    repeatedCount: entry.count,
    component: "reconciliation",
  });
}

function reportMonotonicViolation(params) {
  const {
    applicationId,
    prevVersion,
    nextVersion,
    prevEpoch,
    nextEpoch,
  } = params;

  const meta = orchestrationLogContext({
    applicationId,
    regressionType: "monotonic_violation",
    staleBy: nextVersion < prevVersion ? "version" : "epoch",
    replayDetected: false,
    repeatedCount: 1,
    component: "orchestration",
    orchestrationVersion: nextVersion,
    orchestrationEpoch: nextEpoch,
    prevVersion,
    prevEpoch,
  });

  metrics.increment("orchestration.version.regression", {
    regressionType: "monotonic_violation",
  });

  logError(
    "VERSION_REGRESSION_FATAL",
    new Error("orchestration monotonic ordering violation"),
    meta
  );
}

function surfaceRegression(params) {
  const {
    regressionType,
    applicationId,
    staleBy,
    replayDetected = false,
    repeatedCount = 1,
    component = "reconciliation",
    orchestrationVersion,
    orchestrationEpoch,
  } = params;

  const meta = orchestrationLogContext({
    applicationId,
    regressionType,
    staleBy,
    replayDetected,
    repeatedCount,
    component,
    orchestrationVersion,
    orchestrationEpoch,
  });

  metrics.increment("orchestration.version.regression", { regressionType });

  if (regressionType === "monotonic_violation") {
    logError(
      "VERSION_REGRESSION_FATAL",
      new Error("orchestration regression"),
      meta
    );
    return { regressionType, severity: "error" };
  }

  if (regressionType === "harmless_replay") {
    if (isDebugEnabled("reconciliation")) {
      logDebug("VERSION_REGRESSION_DEBUG", meta, "reconciliation");
    }
    return { regressionType, severity: "debug" };
  }

  orchestrationDedupe.record(
    "warn",
    "VERSION_REGRESSION_DETECTED",
    `${applicationId}:${staleBy}:${regressionType}`,
    meta
  );
  return { regressionType, severity: "warn" };
}

module.exports = {
  classifyClientStale,
  reportMonotonicViolation,
  surfaceRegression,
  REPEATED_THRESHOLD,
};
