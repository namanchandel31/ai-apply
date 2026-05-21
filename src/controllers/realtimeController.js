const {
  addConnection,
  removeConnection,
  touchHeartbeat,
  getConnectionCount,
} = require("../realtime/sseConnectionRegistry");
const { safeSseWrite } = require("../realtime/sseSafeWrite");
const { writeHeartbeat, writeSseEvent, writeReplayEnd } = require("../realtime/sseFormat");
const { readReplayAfter } = require("../realtime/sseReplayBuffer");
const { HEARTBEAT_MS } = require("../realtime/sseGateway");
const { metrics } = require("../observability/orchestrationMetrics");
const { logInfo, logError } = require("../utils/logger");

function streamRealtimeController(req, res) {
  const userId = req.user.id;
  const tabId = String(req.query.tabId || "default");
  const lastEventId =
    req.headers["last-event-id"] ||
    req.headers["Last-Event-ID"] ||
    req.query.lastEventId ||
    null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  safeSseWrite(res, userId, ": connected\n\n");
  addConnection(userId, tabId, res);
  metrics.gauge("orchestration.sse.connections", getConnectionCount());

  void (async () => {
    if (lastEventId) {
      const { events, status } = await readReplayAfter(userId, lastEventId);
      if (status === "expired") {
        res.setHeader("X-Replay-Status", "expired");
        metrics.increment("orchestration.replay.tier3_replay_expired");
        logInfo("REPLAY_EXPIRED", { userId, tabId, lastEventId });
      } else if (status === "miss") {
        res.setHeader("X-Replay-Status", "miss");
        metrics.increment("orchestration.replay.miss_count");
        logInfo("REPLAY_MISS", { userId, tabId, lastEventId });
      }
      for (const { eventId, payload } of events) {
        if (res.writableEnded || res.destroyed) break;
        writeSseEvent(res, userId, "application.updated", payload, eventId);
      }
      writeReplayEnd(res, userId);
      logInfo("REPLAY_COMPLETE", {
        userId,
        tabId,
        replayCount: events.length,
        firstId: events[0]?.eventId,
        lastId: events[events.length - 1]?.eventId,
      });
    }
  })();

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) return;
    writeHeartbeat(res, userId);
    touchHeartbeat(userId, tabId, res);
  }, HEARTBEAT_MS);

  let cleaned = false;
  const cleanup = (reason) => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    removeConnection(userId, tabId, res);
    metrics.gauge("orchestration.sse.connections", getConnectionCount());
    if (reason) {
      logInfo("SSE_CLIENT_DISCONNECTED", { userId, tabId, reason });
    }
  };

  req.on("close", () => cleanup("req_close"));
  req.on("aborted", () => cleanup("req_aborted"));
  res.on("close", () => cleanup("res_close"));
  res.on("error", (err) => {
    const code = err?.code;
    if (code === "ECONNRESET" || code === "EPIPE") {
      cleanup(code);
      return;
    }
    logError("SSE_RESPONSE_ERROR", err, { userId, tabId, error_code: code });
    cleanup("res_error");
  });

  const socket = req.socket;
  if (socket) {
    socket.on("error", (err) => {
      const code = err?.code;
      if (code === "ECONNRESET" || code === "EPIPE") {
        cleanup(code);
        return;
      }
      logError("SSE_SOCKET_ERROR", err, { userId, tabId, error_code: code });
      cleanup("socket_error");
    });
  }
}

module.exports = { streamRealtimeController };
