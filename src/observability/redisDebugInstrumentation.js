const DEBUG_ENDPOINT =
  "http://127.0.0.1:7895/ingest/718dab8a-57b8-413a-b1ad-ea759aa5bf96";
const DEBUG_SESSION_ID = "f71764";

let connectionCounter = 0;

function nextConnectionId(prefix = "redis") {
  connectionCounter += 1;
  return `${prefix}-${connectionCounter}`;
}

function emitDebugLog(payload) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      timestamp: Date.now(),
      runId: "pre-fix",
      ...payload,
    }),
  }).catch(() => {});
  // #endregion
}

function getConnectionRefId(client) {
  if (!client) return null;
  if (!client.__debugConnectionId) {
    client.__debugConnectionId = nextConnectionId("bullmq");
  }
  return client.__debugConnectionId;
}

function attachRedisDebugInstrumentation(client, { role, hypothesisId = "C" } = {}) {
  if (!client || client.__redisDebugInstrumentationAttached) {
    return getConnectionRefId(client);
  }

  client.__redisDebugInstrumentationAttached = true;
  const connectionId = getConnectionRefId(client);

  const logRedisEvent = (event, extra = {}) => {
    emitDebugLog({
      location: "redisDebugInstrumentation.js:logRedisEvent",
      message: "REDIS_EVENT",
      hypothesisId,
      data: {
        connectionId,
        connectionRole: role,
        event,
        clientStatus: client.status,
        ...extra,
      },
    });
  };

  client.on("connect", () => logRedisEvent("connect"));
  client.on("ready", () => logRedisEvent("ready"));
  client.on("close", () => logRedisEvent("close"));
  client.on("end", () => logRedisEvent("end"));
  client.on("reconnecting", (delay) =>
    logRedisEvent("reconnecting", { reconnectDelayMs: delay })
  );
  client.on("error", (err) =>
    logRedisEvent("error", {
      errorCode: err?.code,
      errorMessage: err?.message,
      errorName: err?.name,
    })
  );

  emitDebugLog({
    location: "redisDebugInstrumentation.js:attachRedisDebugInstrumentation",
    message: "REDIS_INSTRUMENTATION_ATTACHED",
    hypothesisId,
    data: {
      connectionId,
      connectionRole: role,
      clientStatus: client.status,
    },
  });

  return connectionId;
}

function logBullmqComponentBinding({
  componentType,
  componentName,
  connection,
  hypothesisId,
  extra = {},
}) {
  emitDebugLog({
    location: "redisDebugInstrumentation.js:logBullmqComponentBinding",
    message: "BULLMQ_COMPONENT_BOUND",
    hypothesisId,
    data: {
      componentType,
      componentName,
      connectionId: connection ? getConnectionRefId(connection) : "dedicated-options",
      connectionStatus: connection?.status ?? "n/a",
      sharedConnectionRef: true,
      ...extra,
    },
  });
}

function logLifecyclePhase(phase, hypothesisId, extra = {}) {
  emitDebugLog({
    location: "redisDebugInstrumentation.js:logLifecyclePhase",
    message: "LIFECYCLE_PHASE",
    hypothesisId,
    data: { phase, ...extra },
  });
}

module.exports = {
  attachRedisDebugInstrumentation,
  logBullmqComponentBinding,
  logLifecyclePhase,
  getConnectionRefId,
};
