const { logInfo } = require("../utils/logger");

/**
 * Standard envelope for grep-friendly realtime lifecycle logs.
 * High-cardinality IDs belong in logs only, never metrics tags.
 */
function logRealtimeLifecycle(event, fields = {}) {
  logInfo(event, {
    component: "realtime",
    ...fields,
  });
}

function envelopeFromPayload(payload, extra = {}) {
  if (!payload) return { ...extra };
  return {
    applicationId: payload.applicationId,
    userId: payload.userId,
    version: payload.version,
    orchestrationEpoch: payload.orchestrationEpoch,
    status: payload.status,
    uiStatus: payload.uiStatus,
    updatedAt: payload.updatedAt,
    ...extra,
  };
}

module.exports = { logRealtimeLifecycle, envelopeFromPayload };
