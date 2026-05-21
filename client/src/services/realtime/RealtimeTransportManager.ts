/**
 * Process-lifetime SSE transport singleton.
 * eventId / Last-Event-ID are transport cursors only — business ordering uses version.
 */
import {
  createSseTransport,
  type ConnectionState,
  type TransportPhase,
} from "./transport/sseTransport";

export type TransportFrameMeta = {
  eventId?: string;
  isReplay: boolean;
};

export type TransportFrameHandler = (
  eventName: string,
  dataJson: string,
  meta: TransportFrameMeta
) => void;

type StateListener = (state: ConnectionState) => void;
type PhaseListener = (phase: TransportPhase) => void;

let transport: ReturnType<typeof createSseTransport> | null = null;
let connectionState: ConnectionState = "disconnected";
let transportPhase: TransportPhase = "idle";
const stateListeners = new Set<StateListener>();
const phaseListeners = new Set<PhaseListener>();
let frameHandler: TransportFrameHandler | null = null;
let replayCompleteHandler: (() => void) | null = null;

function ensureTransport() {
  if (transport) return transport;
  transport = createSseTransport({
    onStateChange: (s) => {
      connectionState = s;
      for (const l of stateListeners) l(s);
    },
    onPhaseChange: (p) => {
      transportPhase = p;
      for (const l of phaseListeners) l(p);
    },
    onReplayComplete: () => {
      replayCompleteHandler?.();
    },
    onFrame: (eventName, dataJson, meta) => {
      frameHandler?.(eventName, dataJson, meta);
    },
  });
  return transport;
}

export function getRealtimeTransportManager() {
  return {
    connect() {
      ensureTransport().connect();
    },
    disconnect() {
      transport?.disconnect();
    },
    shutdown() {
      transport?.shutdown();
      transport = null;
      connectionState = "disconnected";
      transportPhase = "idle";
      frameHandler = null;
      replayCompleteHandler = null;
    },
    getState: () => connectionState,
    getPhase: () => transportPhase,
    getDisconnectDurationMs: () => ensureTransport().getDisconnectDurationMs(),
    getConnectionGeneration: () => ensureTransport().getConnectionGeneration(),
    getLastReplayStatus: () => ensureTransport().getLastReplayStatus(),
    setFrameHandler(handler: TransportFrameHandler | null) {
      frameHandler = handler;
    },
    setReplayCompleteHandler(handler: (() => void) | null) {
      replayCompleteHandler = handler;
    },
    subscribeState(listener: StateListener): () => void {
      stateListeners.add(listener);
      listener(connectionState);
      return () => stateListeners.delete(listener);
    },
    subscribePhase(listener: PhaseListener): () => void {
      phaseListeners.add(listener);
      listener(transportPhase);
      return () => phaseListeners.delete(listener);
    },
  };
}

export type RealtimeTransportManager = ReturnType<typeof getRealtimeTransportManager>;
