import { api } from "@/lib/api";
import { getTabId } from "@/services/orchestration/orchestrationBroadcast";
import { getLastEventId, setLastEventId } from "../replay/lastEventIdStore";
import { parseSseBlock, parseSseChunk } from "../events/parseSseFrame";
import { createReconnectLogPolicy } from "@/services/logging/reconnectLogPolicy";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";

export type ConnectionState = "connected" | "degraded" | "disconnected";

export type TransportPhase = "idle" | "replaying" | "live";

const BACKOFF_STEPS = [1000, 2000, 5000, 10000, 30000];
const HEARTBEAT_TIMEOUT_MS = 45_000;
const STABLE_CONNECTED_MS = 2000;
const JITTER_MAX_MS = 500;
const MIN_CONNECT_GAP_MS = 500;
const MAX_RECONNECTS_PER_WINDOW = 20;
const RECONNECT_WINDOW_MS = 10 * 60_000;

export type SseTransportOptions = {
  onFrame: (eventName: string, dataJson: string, meta: { eventId?: string; isReplay: boolean }) => void;
  onStateChange: (state: ConnectionState) => void;
  onPhaseChange?: (phase: TransportPhase) => void;
  onReplayComplete?: () => void;
};

export function createSseTransport(options: SseTransportOptions) {
  const reconnectLog = createReconnectLogPolicy();
  let abortController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffIndex = 0;
  let disposed = false;
  let connectInFlight = false;
  let connectionGeneration = 0;
  let activeGeneration = 0;
  let state: ConnectionState = "disconnected";
  let phase: TransportPhase = "idle";
  let lastConnectAt = 0;
  let reconnectCount = 0;
  let reconnectWindowStart = 0;
  let replayMode = false;
  let disconnectedAt: number | null = null;
  let lastReplayStatus: string | null = null;

  const setPhase = (next: TransportPhase) => {
    if (phase === next) return;
    phase = next;
    options.onPhaseChange?.(next);
    if (next === "replaying" && isDebugEnabled("reconciliation")) {
      logDebug("REPLAY_MODE_ENTER", { generation: activeGeneration }, "reconciliation");
    }
    if (next === "live" && isDebugEnabled("reconciliation")) {
      logDebug("REPLAY_MODE_EXIT", { generation: activeGeneration }, "reconciliation");
    }
  };

  const setState = (next: ConnectionState) => {
    if (state === next) return;
    state = next;
    reconnectLog.onStateChange(next);
    options.onStateChange(next);
    if (next === "disconnected" && disconnectedAt === null) {
      disconnectedAt = Date.now();
    }
    if (next === "connected") {
      disconnectedAt = null;
    }
  };

  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (stableTimer) clearTimeout(stableTimer);
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    reconnectTimer = null;
    stableTimer = null;
    heartbeatTimer = null;
  };

  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      if (disposed) return;
      setState("degraded");
      abortController?.abort();
      scheduleReconnect(true);
    }, HEARTBEAT_TIMEOUT_MS);
  };

  const scheduleReconnect = (fromTimeout = false) => {
    if (disposed) return;
    const now = Date.now();
    if (reconnectWindowStart === 0 || now - reconnectWindowStart > RECONNECT_WINDOW_MS) {
      reconnectWindowStart = now;
      reconnectCount = 0;
    }
    reconnectCount += 1;
    metrics.increment("orchestration.sse.reconnect_count");
    if (reconnectCount > MAX_RECONNECTS_PER_WINDOW) {
      setState("degraded");
      return;
    }

    clearTimers();
    setState(fromTimeout ? "degraded" : "disconnected");
    setPhase("idle");

    const hidden =
      typeof document !== "undefined" && document.visibilityState === "hidden";
    const base = BACKOFF_STEPS[Math.min(backoffIndex, BACKOFF_STEPS.length - 1)] ?? 30000;
    const delay = base + Math.floor(Math.random() * JITTER_MAX_MS);
    backoffIndex = Math.min(backoffIndex + 1, BACKOFF_STEPS.length - 1);

    reconnectLog.onReconnectAttempt();
    reconnectLog.onBackoff(delay);

    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = null;
        void connect();
      },
      hidden ? delay * 2 : delay
    );
  };

  async function connect() {
    if (disposed || connectInFlight) return;

    const now = Date.now();
    if (now - lastConnectAt < MIN_CONNECT_GAP_MS) return;
    lastConnectAt = now;

    const token = api.getToken();
    if (!token) {
      setState("disconnected");
      return;
    }

    connectInFlight = true;
    connectionGeneration += 1;
    const myGeneration = connectionGeneration;
    activeGeneration = myGeneration;

    abortController?.abort();
    abortController = new AbortController();
    if (state !== "connected") {
      setState("degraded");
    }

    const lastEventId = getLastEventId();
    const tabId = getTabId();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    };
    if (lastEventId) {
      headers["Last-Event-ID"] = lastEventId;
    }

    if (isDebugEnabled("transport")) {
      logDebug("SSE_CONNECT_ATTEMPT", { tabId, generation: myGeneration, lastEventId }, "transport");
    }

    try {
      const url = `/api/realtime/stream?tabId=${encodeURIComponent(tabId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: abortController.signal,
      });

      if (myGeneration !== connectionGeneration) return;

      lastReplayStatus = res.headers.get("X-Replay-Status");
      if (lastReplayStatus === "expired") {
        metrics.increment("orchestration.replay.tier3_replay_expired");
      } else if (lastReplayStatus === "miss") {
        metrics.increment("orchestration.replay.miss_count");
      }

      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed (${res.status})`);
      }

      replayMode = Boolean(lastEventId);
      if (replayMode) {
        setPhase("replaying");
      } else {
        setPhase("live");
      }

      stableTimer = setTimeout(() => {
        if (disposed || myGeneration !== connectionGeneration) return;
        backoffIndex = 0;
        setState("connected");
        reconnectLog.onStableConnected();
      }, STABLE_CONNECTED_MS);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      resetHeartbeat();

      while (!disposed && myGeneration === connectionGeneration) {
        const { done, value } = await reader.read();
        if (done) break;

        resetHeartbeat();
        buffer += decoder.decode(value, { stream: true });
        const { blocks, rest } = parseSseChunk(buffer);
        buffer = rest;

        for (const block of blocks) {
          if (myGeneration !== connectionGeneration) break;
          const parsed = parseSseBlock(block);
          if (!parsed) continue;

          if (parsed.eventName === "replay.end") {
            replayMode = false;
            setPhase("live");
            options.onReplayComplete?.();
            if (isDebugEnabled("reconciliation")) {
              logDebug("LIVE_QUEUE_DRAIN_AFTER_REPLAY", { generation: myGeneration }, "reconciliation");
            }
            continue;
          }

          if (parsed.eventId) {
            setLastEventId(parsed.eventId);
          }

          options.onFrame(parsed.eventName, parsed.data, {
            eventId: parsed.eventId,
            isReplay: replayMode,
          });
        }
      }

      if (!disposed && myGeneration === connectionGeneration) {
        scheduleReconnect();
      }
    } catch (err) {
      if (disposed || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      if (myGeneration === connectionGeneration) {
        scheduleReconnect();
      }
    } finally {
      connectInFlight = false;
    }
  }

  function disconnect() {
    clearTimers();
    abortController?.abort();
    abortController = null;
    connectInFlight = false;
    setPhase("idle");
    if (!disposed) {
      setState("disconnected");
    }
  }

  function shutdown() {
    disposed = true;
    disconnect();
  }

  function getState(): ConnectionState {
    return state;
  }

  function getPhase(): TransportPhase {
    return phase;
  }

  function getDisconnectDurationMs(): number {
    if (!disconnectedAt) return 0;
    return Date.now() - disconnectedAt;
  }

  function getConnectionGeneration(): number {
    return connectionGeneration;
  }

  function getLastReplayStatus(): string | null {
    return lastReplayStatus;
  }

  return {
    connect,
    disconnect,
    shutdown,
    getState,
    getPhase,
    getDisconnectDurationMs,
    getConnectionGeneration,
    getLastReplayStatus,
  };
}
