const { metrics } = require("../observability/orchestrationMetrics");
const { logInfo } = require("../utils/logger");

/** @type {Map<string, Map<string, { res: import('http').ServerResponse, connectedAt: number, lastHeartbeatAt: number }>>} */
const connectionsByUserTab = new Map();

function userKey(userId) {
  return String(userId);
}

function addConnection(userId, tabId, res) {
  const uid = userKey(userId);
  const tid = tabId || "default";
  if (!connectionsByUserTab.has(uid)) {
    connectionsByUserTab.set(uid, new Map());
  }
  const tabMap = connectionsByUserTab.get(uid);

  const existing = tabMap.get(tid);
  if (existing && existing.res !== res) {
    try {
      if (!existing.res.writableEnded) existing.res.end();
    } catch {
      /* ignore */
    }
    logInfo("SSE_TAB_SUPERSEDED", { userId: uid, tabId: tid });
  }

  const now = Date.now();
  tabMap.set(tid, { res, connectedAt: now, lastHeartbeatAt: now });
  logInfo("SSE_CLIENT_CONNECTED", {
    userId: uid,
    tabId: tid,
    connectionCount: getConnectionCount(),
    userConnections: tabMap.size,
  });
  metrics.gauge("orchestration.sse.connections", getConnectionCount());
}

function touchHeartbeat(userId, tabId, res) {
  const entry = connectionsByUserTab.get(userKey(userId))?.get(tabId || "default");
  if (entry && entry.res === res) {
    entry.lastHeartbeatAt = Date.now();
  }
}

function removeConnection(userId, tabId, res) {
  const uid = userKey(userId);
  const tid = tabId || "default";
  const tabMap = connectionsByUserTab.get(uid);
  if (!tabMap) return;
  const entry = tabMap.get(tid);
  if (entry && entry.res === res) {
    tabMap.delete(tid);
  }
  if (tabMap.size === 0) {
    connectionsByUserTab.delete(uid);
  }
  metrics.gauge("orchestration.sse.connections", getConnectionCount());
}

function getConnectionsForUser(userId) {
  const tabMap = connectionsByUserTab.get(userKey(userId));
  if (!tabMap) return [];
  return [...tabMap.values()].map((e) => e.res);
}

function getStaleConnections(maxIdleMs) {
  const now = Date.now();
  const stale = [];
  for (const [userId, tabMap] of connectionsByUserTab) {
    for (const [tabId, entry] of tabMap) {
      if (now - entry.lastHeartbeatAt > maxIdleMs) {
        stale.push({ userId, tabId, entry });
      }
    }
  }
  return stale;
}

function getConnectionCount() {
  let total = 0;
  for (const tabMap of connectionsByUserTab.values()) {
    total += tabMap.size;
  }
  return total;
}

function broadcastToUser(userId, writeFn) {
  const responses = getConnectionsForUser(userId);
  if (!responses.length) return 0;

  let sent = 0;
  const uid = userKey(userId);
  const tabMap = connectionsByUserTab.get(uid);

  for (const res of responses) {
    if (res.writableEnded || res.destroyed) {
      for (const [tabId, entry] of tabMap ?? []) {
        if (entry.res === res) tabMap.delete(tabId);
      }
      continue;
    }
    try {
      const ok = writeFn(res);
      if (ok !== false) sent += 1;
    } catch (err) {
      const code = err?.code;
      if (code === "ECONNRESET" || code === "EPIPE") {
        try {
          if (!res.writableEnded) res.end();
        } catch (_) {
          /* ignore */
        }
        metrics.increment("orchestration.sse.write_reset", { code });
      }
      for (const [tabId, entry] of tabMap ?? []) {
        if (entry.res === res) tabMap.delete(tabId);
      }
    }
  }

  if (tabMap && tabMap.size === 0) {
    connectionsByUserTab.delete(uid);
  }
  return sent;
}

function resetRegistryForTests() {
  connectionsByUserTab.clear();
}

module.exports = {
  addConnection,
  removeConnection,
  touchHeartbeat,
  getConnectionsForUser,
  getConnectionCount,
  broadcastToUser,
  getStaleConnections,
  resetRegistryForTests,
};
