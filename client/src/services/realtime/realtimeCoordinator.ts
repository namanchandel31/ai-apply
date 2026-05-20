import { api } from "@/lib/api";
import {
  globalOrchestrationRegistry,
  type ApplicationUpdatedPayload,
} from "@/services/orchestration/orchestrationRegistry";
import {
  createOrchestrationBroadcast,
  type OrchestrationBroadcastMessage,
} from "@/services/orchestration/orchestrationBroadcast";
import { createTabLeader } from "@/services/orchestration/orchestrationTabLeader";
import { shouldApplyEvent } from "./reconciliation/shouldApplyEvent";
import { logEventForReason } from "./reconciliation/reconciliationDiagnostics";
import { ReconciliationHealth } from "./reconciliation/invalidateAndRefresh";
import { createChannelRouter } from "./events/channelRouter";
import { normalizeApplicationEvent } from "./events/normalizeApplicationEvent";
import { createEventBus } from "./subscriptions/eventBus";
import { createSseTransport, type ConnectionState } from "./transport/sseTransport";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";

const PRE_HYDRATION_BUFFER_MAX = 50;

export type RealtimeCoordinator = {
  start: () => () => void;
  disconnect: () => void;
  hydrate: () => Promise<void>;
  getConnectionState: () => ConnectionState;
  isLeader: () => boolean;
  subscribePresentation: (fn: (payload: ApplicationUpdatedPayload) => void) => () => void;
  reviveApplication: (applicationId: string, nextEpoch: number) => void;
  broadcastRevive: (applicationId: string, nextEpoch: number) => void;
  broadcastTerminal: (applicationId: string) => void;
  registry: typeof globalOrchestrationRegistry;
};

export function createRealtimeCoordinator(
  onStateChange?: (state: ConnectionState) => void
): RealtimeCoordinator {
  const bus = createEventBus();
  const registry = globalOrchestrationRegistry;
  const health = new ReconciliationHealth();
  const preHydrationBuffer: ApplicationUpdatedPayload[] = [];
  let hydrateInFlight: Promise<void> | null = null;
  let invalidateDebounce: ReturnType<typeof setTimeout> | null = null;
  let isLeader = false;
  let transportConnected = false;

  const applyEvent = (payload: ApplicationUpdatedPayload, fromBroadcast = false) => {
    const before = registry.get(payload.applicationId);
    const { apply, reason } = shouldApplyEvent(before, payload);
    logEventForReason(payload.applicationId, reason, apply);

    if (!apply) {
      if (health.recordReject(payload.applicationId)) {
        registry.invalidate(payload.applicationId);
        void scheduleHydrate();
      }
      return;
    }

    if (health.checkImpossibleApply(registry, payload.applicationId, payload)) {
      registry.invalidate(payload.applicationId);
      void scheduleHydrate();
      return;
    }

    registry.applyAcceptedEvent(payload);
    health.clear(payload.applicationId);
    bus.publish(payload);

    if (!fromBroadcast && broadcast) {
      broadcast.post({ type: "event", payload });
    }
  };

  const route = createChannelRouter({
    applications: (payload) => {
      if (!registry.isHydrated()) {
        if (preHydrationBuffer.length >= PRE_HYDRATION_BUFFER_MAX) {
          preHydrationBuffer.shift();
        }
        preHydrationBuffer.push(payload);
        return;
      }
      applyEvent(payload);
    },
  });

  const transport = createSseTransport({
    onStateChange: (s) => onStateChange?.(s),
    onFrame: (eventName, dataJson) => {
      try {
        const raw = JSON.parse(dataJson) as Record<string, unknown>;
        const normalized = normalizeApplicationEvent(raw, eventName);
        if (!normalized) return;
        route(normalized.channel || "applications", normalized);
      } catch {
        // ignore malformed frames
      }
    },
  });

  const drainPreHydrationBuffer = () => {
    const buffered = [...preHydrationBuffer];
    preHydrationBuffer.length = 0;
    for (const payload of buffered) {
      applyEvent(payload);
    }
  };

  const scheduleHydrate = (): Promise<void> => {
    if (hydrateInFlight) return hydrateInFlight;
    hydrateInFlight = hydrate().finally(() => {
      hydrateInFlight = null;
    });
    return hydrateInFlight;
  };

  const hydrate = async () => {
    if (!api.getToken()) return;
    const started = performance.now();
    registry.resetHydration();
    const res = await api.getOrchestrationActive();
    registry.hydrateFromServer(res.data.states);
    drainPreHydrationBuffer();
    const durationMs = Math.round(performance.now() - started);
    metrics.histogram("orchestration.hydration.duration_ms", durationMs);
    if (isDebugEnabled("hydration")) {
      logDebug("HYDRATION_COMPLETE", {
        count: res.data.states.length,
        durationMs,
        component: "hydration",
      }, "hydration");
    }
  };

  const connectTransport = () => {
    if (transportConnected || !isLeader) return;
    transportConnected = true;
    transport.connect();
    broadcast?.post({ type: "leader_claim", ts: Date.now() });
  };

  const disconnectTransport = () => {
    if (!transportConnected) return;
    transportConnected = false;
    transport.disconnect();
    broadcast?.post({ type: "leader_release" });
  };

  const broadcast = createOrchestrationBroadcast((msg: OrchestrationBroadcastMessage) => {
    switch (msg.type) {
      case "revive":
        registry.revive(msg.applicationId, msg.orchestrationEpoch);
        break;
      case "terminal":
        registry.markTerminal(msg.applicationId);
        break;
      case "invalidate":
        if (msg.applicationId) registry.invalidate(msg.applicationId);
        else registry.invalidate();
        if (invalidateDebounce) clearTimeout(invalidateDebounce);
        invalidateDebounce = setTimeout(() => void scheduleHydrate(), 300);
        break;
      case "event":
        if (!isLeader) applyEvent(msg.payload, true);
        break;
      case "reconnect_scheduled":
        break;
      default:
        break;
    }
  });

  const tabLeader = createTabLeader({
    onBecomeLeader: async () => {
      isLeader = true;
      await scheduleHydrate();
      connectTransport();
    },
    onLoseLeadership: () => {
      isLeader = false;
      disconnectTransport();
    },
  });

  return {
    start: () => {
      if (!api.getToken()) return () => {};
      const stopLeader = tabLeader.start();
      return () => {
        stopLeader();
        disconnectTransport();
        broadcast?.close();
        if (invalidateDebounce) clearTimeout(invalidateDebounce);
      };
    },
    disconnect: () => disconnectTransport(),
    hydrate: scheduleHydrate,
    getConnectionState: () => transport.getState(),
    isLeader: () => isLeader,
    subscribePresentation: (fn) => bus.subscribe(fn),
    reviveApplication: (id, epoch) => registry.revive(id, epoch),
    broadcastRevive: (id, epoch) => {
      registry.revive(id, epoch);
      broadcast?.post({ type: "revive", applicationId: id, orchestrationEpoch: epoch });
    },
    broadcastTerminal: (id) => {
      registry.markTerminal(id);
      broadcast?.post({ type: "terminal", applicationId: id });
    },
    registry,
  };
}
