const crypto = require("crypto");
const { runWithTrace } = require("../observability/orchestrationTraceContext");

/**
 * Tracing middleware — requestId + traceId (AsyncLocalStorage for downstream logs).
 */
const tracingMiddleware = (req, res, next) => {
  const requestId = crypto.randomUUID();
  const traceId = req.headers["x-trace-id"] || requestId;
  req.requestId = requestId;
  req.traceId = traceId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Trace-Id", traceId);

  runWithTrace({ traceId, requestId, component: "api" }, () => next());
};

module.exports = tracingMiddleware;
