import { api } from "@/lib/api";
import {
  globalOrchestrationRegistry,
  type ApplicationUpdatedPayload,
} from "@/services/orchestration/orchestrationRegistry";
import {
  createOrchestrationBroadcast,
  type OrchestrationBroadcastMessage,
  type OrchestrationBroadcastPost,
} from "@/services/orchestration/orchestrationBroadcast";
import { createTabLeader } from "@/services/orchestration/orchestrationTabLeader";
import { shouldApplyOrchestrationEvent } from "./reconciliation/shouldApplyRealtimeEvent";
import { logEventForReason } from "./reconciliation/reconciliationDiagnostics";
import { ReconciliationHealth } from "./reconciliation/invalidateAndRefresh";
import { createChannelRouter } from "./events/channelRouter";
import { normalizeApplicationEvent } from "./events/normalizeApplicationEvent";
import { createEventBus } from "./subscriptions/eventBus";
import type { ConnectionState } from "./transport/sseTransport";
import { getRealtimeTransportManager } from "./RealtimeTransportManager";
import { createEventBatchProcessor } from "./cache/eventBatchProcessor";
import { assertLeaderOnly } from "./leaderGuards";
import {
  getAffectedApplicationIdsForGap,
  runReconnectRecovery,
} from "./reconnectRecovery";
import { MAX_REPLAY_BACKLOG } from "./realtimeQueueLimits";
import {
  isRealtimeDegraded,
  resetCatastrophicRecoveryForManual,
} from "./CatastrophicRecoveryGuard";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";
import { isDebugEnabled } from "@/services/logging/debugFlags";

const PRE_HYDRATION_BUFFER_MAX = 50;

export type StatePatch = {
  applicationId: string;
  status?: string;
  uiStatus?: string;
  version?: number;
  orchestrationEpoch?: number;
  updatedAt?: string;
  terminal?: boolean;
  executionTerminal?: boolean;
  pollable?: boolean;
  canRetry?: boolean;
  canContinue?: boolean;
  role?: string | null;
  company?: string | null;
};

export type RealtimeCoordinator = {
  start: () => () => void;
  disconnect: () => void;
  shutdown: () => void;
  hydrate: (opts?: { force?: boolean }) => Promise<void>;
  getConnectionState: () => ConnectionState;
  isLeader: () => boolean;
  subscribePresentation: (fn: (payload: ApplicationUpdatedPayload) => void) => () => void;
  reviveApplication: (applicationId: string, nextEpoch: number) => void;
  broadcastRevive: (applicationId: string, nextEpoch: number) => void;
  broadcastTerminal: (applicationId: string) => void;
  registry: typeof globalOrchestrationRegistry;
  isDegraded: () => boolean;
  resetDegraded: () => void;
};

function payloadToStatePatch(p: ApplicationUpdatedPayload): StatePatch {
  return {
    applicationId: p.applicationId,
    status: p.status,
    uiStatus: p.uiStatus,
    version: p.version,
    orchestrationEpoch: p.orchestrationEpoch,
    updatedAt: p.updatedAt,
    terminal: p.terminal,
    executionTerminal: p.executionTerminal,
    pollable: p.pollable,
    canRetry: p.canRetry,
    canContinue: p.canContinue,
    role: p.role,
    company: p.company,
  };
}

function lastProcessedKey(payload: ApplicationUpdatedPayload): string {
  return `${payload.applicationId}:${payload.version ?? 0}:${payload.orchestrationEpoch ?? 0}:${payload.updatedAt ?? ""}`;
}

export function createRealtimeCoordinator(
  onStateChange?: (state: ConnectionState) => void
): RealtimeCoordinator {
  const bus = createEventBus();
  const registry = globalOrchestrationRegistry;
  const health = new ReconciliationHealth();
  const transportManager = getRealtimeTransportManager();
  const preHydrationBuffer: ApplicationUpdatedPayload[] = [];
  const replayQueue: ApplicationUpdatedPayload[] = [];
  const lastProcessedKeys = new Set<string>();
  let hydrateInFlight: Promise<void> | null = null;
  let bootstrapHydrated = false;
  let isLeader = false;
  let transportConnected = false;
  let replayCount = 0;
  let disconnectBaselineMs = 0;

  const batchProcessor = createEventBatchProcessor((payloads) => {
    const patches: StatePatch[] = [];
    for (const payload of payloads) {
      const key = lastProcessedKey(payload);
      if (lastProcessedKeys.has(key)) continue;
      lastProcessedKeys.add(key);
      if (lastProcessedKeys.size > 5000) {
        lastProcessedKeys.clear();
      }
      bus.publish(payload);
      patches.push(payloadToStatePatch(payload));
    }
    if (patches.length && isLeader) {
      postBroadcast({ type: "state_patch", patches });
    }
  });

  const applyEvent = (payload: ApplicationUpdatedPayload, fromBroadcast = false) => {
    const before = registry.get(payload.applicationId);
    const { apply, reason } = shouldApplyOrchestrationEvent(before, payload);
    logEventForReason(payload.applicationId, reason, apply);

    if (!apply) {
      if (!fromBroadcast && health.recordReject(payload.applicationId)) {
        registry.invalidate(payload.applicationId);
        void runPerAppStatusRecovery(payload.applicationId);
      }
      return;
    }

    if (!fromBroadcast && health.checkImpossibleApply(registry, payload.applicationId, payload)) {
      registry.invalidate(payload.applicationId);
      void runPerAppStatusRecovery(payload.applicationId);
      return;
    }

    registry.applyAcceptedEvent(payload);
    health.clear(payload.applicationId);

    if (fromBroadcast) {
      bus.publish(payload);
      return;
    }

    batchProcessor.enqueue(payload);
  };

  const applyFollowerPatches = (patches: StatePatch[]) => {
    for (const patch of patches) {
      const payload: ApplicationUpdatedPayload = {
        applicationId: patch.applicationId,
        status: patch.status ?? "",
        uiStatus: patch.uiStatus,
        version: patch.version,
        orchestrationEpoch: patch.orchestrationEpoch,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
        terminal: patch.terminal,
        executionTerminal: patch.executionTerminal,
        pollable: patch.pollable,
        canRetry: patch.canRetry,
        canContinue: patch.canContinue,
        role: patch.role,
        company: patch.company,
      };
      applyEvent(payload, true);
    }
  };

  async function runPerAppStatusRecovery(applicationId: string) {
    if (!assertLeaderOnly(isLeader, "tier2_fetch")) return;
    try {
      const res = await api.getApplicationStatus(applicationId);
      const data = res.data as ApplicationUpdatedPayload & { applicationId?: string };
      applyEvent({ ...data, applicationId }, false);
    } catch {
      // ignore — convergence watchdog may retry
    }
  }

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

  const processReplayQueue = () => {
    const queue = [...replayQueue];
    replayQueue.length = 0;
    batchProcessor.setPaused(true);
    for (const payload of queue) {
      applyEvent(payload, false);
    }
    batchProcessor.setPaused(false);
    batchProcessor.flushNow();
  };

  const handleFrame = (
    eventName: string,
    dataJson: string,
    meta: { isReplay: boolean }
  ) => {
    try {
      const raw = JSON.parse(dataJson) as Record<string, unknown>;
      const normalized = normalizeApplicationEvent(raw, eventName);
      if (!normalized) return;

      const channel = normalized.channel || "applications";
      if (channel !== "applications") return;

      if (meta.isReplay) {
        replayCount += 1;
        if (replayQueue.length >= MAX_REPLAY_BACKLOG) {
          metrics.increment("orchestration.replay.backlog_compacted");
          replayQueue.length = 0;
        }
        replayQueue.push(normalized as ApplicationUpdatedPayload);
        return;
      }

      if (transportManager.getPhase() === "replaying") {
        replayQueue.push(normalized as ApplicationUpdatedPayload);
        return;
      }

      route(channel, normalized);
    } catch {
      // ignore malformed frames
    }
  };

  transportManager.setFrameHandler(handleFrame);
  transportManager.subscribeState((s) => onStateChange?.(s));

  const drainPreHydrationBuffer = () => {
    const buffered = [...preHydrationBuffer];
    preHydrationBuffer.length = 0;
    for (const payload of buffered) {
      applyEvent(payload);
    }
  };

  const hydrateBootstrap = async () => {
    if (!assertLeaderOnly(isLeader, "hydrate")) return;
    if (!api.getToken()) return;
    const started = performance.now();
    registry.resetHydration();
    const res = await api.getOrchestrationActive();
    registry.hydrateFromServer(res.data.states);
    bootstrapHydrated = true;
    drainPreHydrationBuffer();
    const durationMs = Math.round(performance.now() - started);
    metrics.histogram("orchestration.hydration.duration_ms", durationMs);
    if (isDebugEnabled("hydration")) {
      logDebug(
        "HYDRATION_COMPLETE",
        { count: res.data.states.length, durationMs, component: "hydration" },
        "hydration"
      );
    }
  };

  const hydrate = async (opts?: { force?: boolean }) => {
    if (!opts?.force && bootstrapHydrated) return;
    if (hydrateInFlight) return hydrateInFlight;
    hydrateInFlight = hydrateBootstrap().finally(() => {
      hydrateInFlight = null;
    });
    return hydrateInFlight;
  };

  const onReplayComplete = async () => {
    processReplayQueue();
    if (!assertLeaderOnly(isLeader, "replay")) return;

    const replayStatus = transportManager.getLastReplayStatus();
    const replayExpiredFlag = replayStatus === "expired";
    const replayMissFlag = replayStatus === "miss";

    const disconnectMs = disconnectBaselineMs || transportManager.getDisconnectDurationMs();
    await runReconnectRecovery(
      {
        disconnectMs,
        replayCount,
        replayExpired: replayExpiredFlag,
        replayMiss: replayMissFlag,
        affectedApplicationIds: getAffectedApplicationIdsForGap(),
        isLeader,
      },
      {
        hydrateBootstrap,
        applyStatusToRegistry: (id, status) => applyEvent({ ...status, applicationId: id }, false),
      }
    );
    replayCount = 0;
  };

  transportManager.setReplayCompleteHandler(() => {
    void onReplayComplete();
  });

  const connectTransport = () => {
    if (!assertLeaderOnly(isLeader, "connect")) return;
    if (transportConnected) return;
    disconnectBaselineMs = transportManager.getDisconnectDurationMs();
    transportConnected = true;
    transportManager.connect();
    postBroadcast({ type: "leader_claim", ts: Date.now() });
  };

  const disconnectTransport = () => {
    if (!transportConnected) return;
    transportConnected = false;
    transportManager.disconnect();
    postBroadcast({ type: "leader_release" });
  };

  let broadcast: ReturnType<typeof createOrchestrationBroadcast> = null;

  const onBroadcastMessage = (msg: OrchestrationBroadcastMessage) => {
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
        break;
      case "state_patch":
        if (!isLeader) applyFollowerPatches(msg.patches);
        break;
      case "reconnect_scheduled":
        break;
      default:
        break;
    }
  };

  const ensureBroadcast = () => {
    if (!broadcast) {
      broadcast = createOrchestrationBroadcast(onBroadcastMessage);
    }
    return broadcast;
  };

  const postBroadcast = (msg: OrchestrationBroadcastPost) => {
    if (!assertLeaderOnly(isLeader, "broadcast_post")) return;
    ensureBroadcast()?.post(msg);
  };

  const closeBroadcast = () => {
    broadcast?.close();
    broadcast = null;
  };

  const tabLeader = createTabLeader({
    onBecomeLeader: async () => {
      isLeader = true;
      if (!bootstrapHydrated) {
        await hydrate();
      }
      connectTransport();
    },
    onLoseLeadership: () => {
      isLeader = false;
      disconnectTransport();
      batchProcessor.setPaused(true);
    },
  });

  return {
    start: () => {
      if (!api.getToken()) return () => {};
      ensureBroadcast();
      const stopLeader = tabLeader.start();
      return () => {
        stopLeader();
        disconnectTransport();
      };
    },
    disconnect: () => disconnectTransport(),
    shutdown: () => {
      disconnectTransport();
      transportManager.shutdown();
      batchProcessor.destroy();
      closeBroadcast();
      bootstrapHydrated = false;
      lastProcessedKeys.clear();
    },
    hydrate,
    getConnectionState: () => transportManager.getState(),
    isLeader: () => isLeader,
    subscribePresentation: (fn) => bus.subscribe(fn),
    reviveApplication: (id, epoch) => registry.revive(id, epoch),
    broadcastRevive: (id, epoch) => {
      registry.revive(id, epoch);
      postBroadcast({ type: "revive", applicationId: id, orchestrationEpoch: epoch });
    },
    broadcastTerminal: (id) => {
      registry.markTerminal(id);
      postBroadcast({ type: "terminal", applicationId: id });
    },
    registry,
    isDegraded: () => isRealtimeDegraded(),
    resetDegraded: () => resetCatastrophicRecoveryForManual(),
  };
}
