import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";
import { getRealtimeTransportManager } from "@/services/realtime/RealtimeTransportManager";
import {
  applicationsQueryOptions,
  setupStatusQueryOptions,
} from "@/queries/bootstrapQueries";
import { bindCacheSyncToCoordinator } from "@/services/realtime/realtimeCacheSession";
import {
  addConnectionListener,
  clearConnectionListeners,
  ensureCoordinatorSession,
  getSharedCoordinatorRef,
  isBootstrapPrefetchDone,
  isCacheSyncBound,
  markBootstrapPrefetchDone,
  markCacheSyncBound,
  shutdownCoordinatorSession,
} from "@/services/realtime/realtimeSession";
import { RealtimeContext } from "./realtimeContext";

/** Call before logout so the next login gets a fresh coordinator + broadcast channel. */
export function shutdownRealtimeSession() {
  shutdownCoordinatorSession();
}

let cacheSyncBound = false;

export function resetRealtimeProviderCacheBinding() {
  cacheSyncBound = false;
}

function subscribeTransportState(listener: () => void) {
  return getRealtimeTransportManager().subscribeState(() => listener());
}

function getTransportSnapshot(): ConnectionState {
  return getRealtimeTransportManager().getState();
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const connectionState = useSyncExternalStore(
    subscribeTransportState,
    getTransportSnapshot,
    () => "disconnected" as ConnectionState
  );

  const coordinator = getSharedCoordinatorRef();
  const [isLeader, setIsLeader] = useState(() => coordinator?.isLeader() ?? false);
  const sseConnected = connectionState === "connected" && isLeader;
  const isDegraded = coordinator?.isDegraded() ?? false;

  useEffect(() => {
    const removeListener = addConnectionListener(() => {
      setIsLeader(getSharedCoordinatorRef()?.isLeader() ?? false);
    });

    if (!api.getToken()) {
      shutdownCoordinatorSession();
      clearConnectionListeners();
      setIsLeader(false);
      return removeListener;
    }

    ensureCoordinatorSession();
    setIsLeader(getSharedCoordinatorRef()?.isLeader() ?? false);

    if (!isBootstrapPrefetchDone()) {
      markBootstrapPrefetchDone();
      void queryClient.ensureQueryData(setupStatusQueryOptions);
      void queryClient.ensureQueryData(applicationsQueryOptions);
    }

    const leaderPoll = setInterval(() => {
      setIsLeader(getSharedCoordinatorRef()?.isLeader() ?? false);
    }, 1000);

    return () => {
      clearInterval(leaderPoll);
      removeListener();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!api.getToken() || !coordinator || isCacheSyncBound()) return;
    markCacheSyncBound();
    return bindCacheSyncToCoordinator(queryClient, coordinator, () => ({
      isLeader: coordinator.isLeader(),
      sseConnected: getTransportSnapshot() === "connected" && coordinator.isLeader(),
      connectionState: getTransportSnapshot(),
    }));
  }, [queryClient, coordinator]);

  const subscribe = useCallback((handler: (event: ApplicationUpdatedPayload) => void) => {
    if (!coordinator) return () => {};
    return coordinator.subscribePresentation(handler);
  }, [coordinator]);

  const reviveApplication = useCallback((applicationId: string, nextEpoch: number) => {
    coordinator?.reviveApplication(applicationId, nextEpoch);
  }, [coordinator]);

  const broadcastRevive = useCallback((applicationId: string, nextEpoch: number) => {
    coordinator?.broadcastRevive(applicationId, nextEpoch);
  }, [coordinator]);

  const hydrate = useCallback(
    () => coordinator?.hydrate({ force: true }) ?? Promise.resolve(),
    [coordinator]
  );

  const resetDegraded = useCallback(() => {
    coordinator?.resetDegraded();
    void coordinator?.hydrate({ force: true });
  }, [coordinator]);

  const value = useMemo(
    () => ({
      connectionState,
      sseConnected,
      isLeader,
      isDegraded,
      subscribe,
      reviveApplication,
      broadcastRevive,
      hydrate,
      resetDegraded,
    }),
    [
      connectionState,
      sseConnected,
      isLeader,
      isDegraded,
      subscribe,
      reviveApplication,
      broadcastRevive,
      hydrate,
      resetDegraded,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export { useRealtime } from "./useRealtime";
