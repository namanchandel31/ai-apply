import { api } from "@/lib/api";
import { parseSseBlock, parseSseChunk } from "../events/parseSseFrame";
import { createReconnectLogPolicy } from "@/services/logging/reconnectLogPolicy";

export type ConnectionState = "connected" | "degraded" | "disconnected";

const BACKOFF_STEPS = [1000, 2000, 5000, 10000, 30000];
const HEARTBEAT_TIMEOUT_MS = 45_000;
const STABLE_CONNECTED_MS = 2000;
const JITTER_MAX_MS = 500;

export type SseTransportOptions = {
  onFrame: (eventName: string, dataJson: string) => void;
  onStateChange: (state: ConnectionState) => void;
};

export function createSseTransport(options: SseTransportOptions) {
  const reconnectLog = createReconnectLogPolicy();
  let abortController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffIndex = 0;
  let disposed = false;
  let state: ConnectionState = "disconnected";
  const setState = (next: ConnectionState) => {
    if (state === next) return;
    const prev = state;
    state = next;
    reconnectLog.onStateChange(next);
    options.onStateChange(next);
    if (prev !== next && next === "connected") {
      // stable connected handled by stableTimer
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
    clearTimers();
    setState(fromTimeout ? "degraded" : "disconnected");

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
    if (disposed) return;

    const token = api.getToken();
    if (!token) {
      setState("disconnected");
      return;
    }

    abortController?.abort();
    abortController = new AbortController();
    setState("degraded");

    try {
      const res = await fetch("/api/realtime/stream", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE connect failed (${res.status})`);
      }

      stableTimer = setTimeout(() => {
        if (disposed) return;
        backoffIndex = 0;
        setState("connected");
        reconnectLog.onStableConnected();
      }, STABLE_CONNECTED_MS);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      resetHeartbeat();

      while (!disposed) {
        const { done, value } = await reader.read();
        if (done) break;

        resetHeartbeat();
        buffer += decoder.decode(value, { stream: true });
        const { blocks, rest } = parseSseChunk(buffer);
        buffer = rest;

        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          options.onFrame(parsed.eventName, parsed.data);
        }
      }

      if (!disposed) {
        scheduleReconnect();
      }
    } catch (err) {
      if (disposed || (err instanceof DOMException && err.name === "AbortError")) {
        return;
      }
      scheduleReconnect();
    }
  }

  function disconnect() {
    disposed = true;
    clearTimers();
    abortController?.abort();
    abortController = null;
    setState("disconnected");
  }

  function getState(): ConnectionState {
    return state;
  }

  return { connect, disconnect, getState };
}
