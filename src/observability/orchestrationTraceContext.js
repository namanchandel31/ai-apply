const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function runWithTrace(fields, fn) {
  const parent = storage.getStore() || {};
  const next = {
    traceId: fields.traceId || fields.requestId || parent.traceId,
    requestId: fields.requestId || parent.requestId,
    orchestrationId: fields.orchestrationId || fields.applicationId || parent.orchestrationId,
    jobId: fields.jobId || parent.jobId,
    component: fields.component || parent.component,
  };
  return storage.run(next, fn);
}

function getTraceStore() {
  return storage.getStore() || {};
}

function getTraceFields(extra = {}) {
  const store = getTraceStore();
  return {
    traceId: extra.traceId || store.traceId,
    requestId: extra.requestId || store.requestId,
    orchestrationId: extra.orchestrationId || store.orchestrationId,
    jobId: extra.jobId || store.jobId,
    component: extra.component || store.component,
  };
}

function mergeTraceIntoPayload(payload, extra = {}) {
  const t = getTraceFields(extra);
  return {
    ...payload,
    traceId: t.traceId,
    requestId: t.requestId,
    orchestrationId: t.orchestrationId || payload.applicationId,
  };
}

module.exports = {
  runWithTrace,
  getTraceStore,
  getTraceFields,
  mergeTraceIntoPayload,
};
