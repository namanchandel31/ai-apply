import { logDebug, logInfo, logWarnDeduped } from "./orchestrationLogger";
import { metrics } from "./metricsHooks";

const DEFAULT_MIN_INTERVAL_MS = 10_000;
const DEFAULT_STORM_WINDOW_MS = 60_000;

export type ConnectionState = "connected" | "degraded" | "disconnected";

export function createReconnectLogPolicy(options?: {
  minReconnectLogIntervalMs?: number;
  stormWindowMs?: number;
}) {
  const minInterval =
    options?.minReconnectLogIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const stormWindowMs = options?.stormWindowMs ?? DEFAULT_STORM_WINDOW_MS;

  let lastLifecycleLogAt = 0;
  let reconnectAttempts = 0;
  let stormWindowStart = Date.now();
  let hadFirstSession = false;
  let stableRecoveryEmitted = false;
  let lastLoggedState: ConnectionState | null = null;

  const onReconnectAttempt = () => {
    metrics.increment("orchestration.reconnect.attempt");
    reconnectAttempts += 1;
    const now = Date.now();
    if (now - stormWindowStart > stormWindowMs) {
      stormWindowStart = now;
      reconnectAttempts = 1;
    }
    if (reconnectAttempts >= 5) {
      logWarnDeduped(
        "RECONNECT_STORM",
        "sse-reconnect-storm",
        {
          component: "transport",
          reconnectAttempts,
          windowMs: stormWindowMs,
          message: `SSE reconnect attempted ${reconnectAttempts} times in ${Math.round(stormWindowMs / 1000)}s`,
        }
      );
    }
  };

  const onBackoff = (delayMs: number) => {
    logWarnDeduped("RECONNECT_BACKOFF", "sse-backoff", {
      component: "transport",
      delayMs,
      retryAttempt: reconnectAttempts,
    });
  };

  const onStateChange = (next: ConnectionState) => {
    const now = Date.now();
    if (next === lastLoggedState) return;

    if (next !== "connected") {
      stableRecoveryEmitted = false;
    }

    if (now - lastLifecycleLogAt < minInterval && next !== "connected") {
      lastLoggedState = next;
      return;
    }

    if (next === "degraded" || next === "disconnected") {
      logDebug("SSE_TRANSPORT_STATE", { connectionState: next }, "transport");
      lastLifecycleLogAt = now;
    }

    lastLoggedState = next;
  };

  const onStableConnected = () => {
    const now = Date.now();
    if (now - lastLifecycleLogAt < minInterval && stableRecoveryEmitted) return;

    if (!hadFirstSession) {
      hadFirstSession = true;
      logDebug("SSE_CONNECTED", { component: "transport" }, "transport");
      metrics.increment("orchestration.sse.connected");
      lastLifecycleLogAt = now;
      return;
    }

    if (stableRecoveryEmitted) return;
    stableRecoveryEmitted = true;
    logInfo("SSE_RECONNECTED", {
      component: "transport",
      connectionState: "connected",
      reconnectAttempts,
    });
    metrics.increment("orchestration.sse.reconnected");
    reconnectAttempts = 0;
    stormWindowStart = Date.now();
    lastLifecycleLogAt = now;
  };

  return {
    onReconnectAttempt,
    onBackoff,
    onStateChange,
    onStableConnected,
  };
}
