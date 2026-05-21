const { removeConnection, getConnectionCount } = require("./sseConnectionRegistry");
const { logInfo, logError } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");

function teardownResponse(res, userId, reason) {
  try {
    if (!res.writableEnded) res.end();
  } catch (_) {
    /* ignore */
  }
  try {
    res.destroy?.();
  } catch (_) {
    /* ignore */
  }
  if (userId) {
    removeConnection(userId, res);
    metrics.gauge("orchestration.sse.connections", getConnectionCount());
  }
  if (reason) {
    logInfo("SSE_CONNECTION_TEARDOWN", { userId, reason });
  }
}

/**
 * Write to an SSE response without crashing the process on client disconnect.
 * @returns {{ ok: boolean, reason?: string }}
 */
function safeSseWrite(res, userId, chunk) {
  if (!res || res.writableEnded || res.destroyed) {
    return { ok: false, reason: "closed" };
  }

  try {
    res.write(chunk);
    return { ok: true };
  } catch (err) {
    const code = err?.code;
    if (code === "ECONNRESET" || code === "EPIPE") {
      teardownResponse(res, userId, code);
      metrics.increment("orchestration.sse.write_reset", { code });
      return { ok: false, reason: code };
    }

    logError("SSE_WRITE_FAILED", err, {
      userId,
      error_code: code,
      error_message: err?.message,
    });
    throw err;
  }
}

module.exports = { safeSseWrite, teardownResponse };
