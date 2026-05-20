const { buildLogContext } = require("./buildLogContext");

/**
 * Standard orchestration log fields.
 * @param {Record<string, unknown>} fields
 */
function orchestrationLogContext(fields = {}) {
  const base = buildLogContext({
    applicationId: fields.applicationId,
    jobId: fields.jobId,
    userId: fields.userId,
    reqId: fields.reqId ?? fields.requestId,
    workerName: fields.workerId ?? fields.workerName,
  });

  return Object.fromEntries(
    Object.entries({
      ...base,
      requestId: fields.requestId ?? fields.reqId,
      orchestrationEpoch: fields.orchestrationEpoch,
      orchestrationVersion: fields.orchestrationVersion ?? fields.version,
      tabId: fields.tabId,
      connectionState: fields.connectionState,
      retryAttempt: fields.retryAttempt,
      reason: fields.reason,
      component: fields.component,
      regressionType: fields.regressionType,
      staleBy: fields.staleBy,
      replayDetected: fields.replayDetected,
      repeatedCount: fields.repeatedCount,
      prevVersion: fields.prevVersion,
      prevEpoch: fields.prevEpoch,
    }).filter(([, value]) => value != null && value !== undefined)
  );
}

module.exports = { orchestrationLogContext };
