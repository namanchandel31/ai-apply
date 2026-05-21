const config = require("../config");
const { logInfo } = require("../utils/logger");
const { metrics } = require("../observability/orchestrationMetrics");
const {
  getStaleConnections,
  removeConnection,
} = require("./sseConnectionRegistry");

const REAP_INTERVAL_MS = 30_000;

let reaperStarted = false;

function startSseZombieReaper() {
  if (reaperStarted) return;
  reaperStarted = true;

  const timeoutMs = config.realtime.SSE_ZOMBIE_TIMEOUT_MS;

  setInterval(() => {
    const stale = getStaleConnections(timeoutMs);
    for (const { userId, tabId, entry } of stale) {
      const age = Date.now() - entry.connectedAt;
      logInfo("SSE_ZOMBIE_REAPED", {
        userId,
        tabId,
        connectionAge: age,
        lastHeartbeatAt: entry.lastHeartbeatAt,
      });
      metrics.increment("orchestration.sse.zombie_reaped");
      try {
        if (!entry.res.writableEnded) entry.res.end();
      } catch {
        /* ignore */
      }
      removeConnection(userId, tabId, entry.res);
    }
  }, REAP_INTERVAL_MS).unref?.();
}

module.exports = { startSseZombieReaper };
