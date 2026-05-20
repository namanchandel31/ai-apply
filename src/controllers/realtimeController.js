const {
  addConnection,
  removeConnection,
  getConnectionCount,
} = require("../realtime/sseConnectionRegistry");
const { writeHeartbeat } = require("../realtime/sseFormat");
const { HEARTBEAT_MS } = require("../realtime/sseGateway");
const { metrics } = require("../observability/orchestrationMetrics");

function streamRealtimeController(req, res) {
  const userId = req.user.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(": connected\n\n");
  addConnection(userId, res);

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    writeHeartbeat(res);
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    removeConnection(userId, res);
    metrics.gauge("orchestration.sse.connections", getConnectionCount());
  };

  req.on("close", cleanup);
  res.on("close", cleanup);
}

module.exports = { streamRealtimeController };
