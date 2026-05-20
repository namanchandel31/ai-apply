const { metrics } = require("../observability/orchestrationMetrics");

/** @type {Map<string, Set<import('http').ServerResponse>>} */
const connectionsByUser = new Map();

function addConnection(userId, res) {
  if (!connectionsByUser.has(userId)) {
    connectionsByUser.set(userId, new Set());
  }
  connectionsByUser.get(userId).add(res);
  logInfo("SSE_CLIENT_CONNECTED", {
    userId,
    connectionCount: getConnectionCount(),
    userConnections: connectionsByUser.get(userId).size,
  });
}

function removeConnection(userId, res) {
  const set = connectionsByUser.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    connectionsByUser.delete(userId);
  }
  metrics.gauge("orchestration.sse.connections", getConnectionCount());
}

function getConnectionsForUser(userId) {
  return connectionsByUser.get(userId) ?? new Set();
}

function getConnectionCount() {
  let total = 0;
  for (const set of connectionsByUser.values()) {
    total += set.size;
  }
  return total;
}

function broadcastToUser(userId, writeFn) {
  const set = getConnectionsForUser(userId);
  if (!set.size) return 0;

  let sent = 0;
  for (const res of set) {
    if (res.writableEnded || res.destroyed) {
      set.delete(res);
      continue;
    }
    try {
      writeFn(res);
      sent += 1;
    } catch (_err) {
      set.delete(res);
    }
  }
  if (set.size === 0) {
    connectionsByUser.delete(userId);
  }
  return sent;
}

module.exports = {
  addConnection,
  removeConnection,
  getConnectionsForUser,
  getConnectionCount,
  broadcastToUser,
};
