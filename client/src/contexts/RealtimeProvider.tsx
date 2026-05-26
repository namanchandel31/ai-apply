import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import { logAuthLifecycle } from "@/auth/authLifecycleLog";
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

/** Call before logout so the next login gets a fresh coordinator + SSE transport. */
export function shutdownRealtimeSession() {
  shutdownCoordinatorSession();
  getRealtimeTransportManager().shutdown();
}

export function resetRealtimeProviderCacheBinding() {
  /* binding reset handled in realtimeSession */
}

function subscribeTransportState(listener: () => void) {
  return getRealtimeTransportManager().subscribeState(() => listener());
}

function getTransportSnapshot(): ConnectionState {
  return getRealtimeTransportManager().getState();
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isResolved, isAuthenticated, session } = useAuthReady();
  const disableRealtime =
    typeof window !== "undefined" && window.localStorage.getItem("debug:disableRealtime") === "1";

  const disableLeaderPoll =
    typeof window !== "undefined" && window.localStorage.getItem("debug:disableLeaderPoll") === "1";

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

    if (!isResolved || !isAuthenticated || !session?.access_token) {
      if (!isAuthenticated) {
        getRealtimeTransportManager().shutdown();
      }
      shutdownCoordinatorSession();
      clearConnectionListeners();
      setIsLeader(false);
      return removeListener;
    }

    if (disableRealtime) {
      shutdownCoordinatorSession();
      clearConnectionListeners();
      setIsLeader(false);
      return removeListener;
    }

    ensureCoordinatorSession();
    setIsLeader(getSharedCoordinatorRef()?.isLeader() ?? false);

    if (!isBootstrapPrefetchDone()) {
      markBootstrapPrefetchDone();
      logAuthLifecycle("BOOTSTRAP_PREFETCH_START");
      void queryClient.ensureQueryData({
        ...setupStatusQueryOptions,
        queryKey: setupStatusQueryOptions.queryKey,
      });
      void queryClient.ensureQueryData({
        ...applicationsQueryOptions,
        queryKey: applicationsQueryOptions.queryKey,
      });
    }

    const leaderPoll = disableLeaderPoll
      ? null
      : setInterval(() => {
          const next = getSharedCoordinatorRef()?.isLeader() ?? false;
          setIsLeader((prev) => (prev === next ? prev : next));
        }, 3000);

    return () => {
      if (leaderPoll) clearInterval(leaderPoll);
      removeListener();
    };
  }, [queryClient, isResolved, isAuthenticated, session?.access_token, disableRealtime, disableLeaderPoll]);

  useEffect(() => {
    if (disableRealtime) return;
    if (!session?.access_token || !coordinator || isCacheSyncBound()) return;
    markCacheSyncBound();
    return bindCacheSyncToCoordinator(queryClient, coordinator, () => ({
      isLeader: coordinator.isLeader(),
      sseConnected: getTransportSnapshot() === "connected" && coordinator.isLeader(),
      connectionState: getTransportSnapshot(),
    }));
  }, [queryClient, coordinator, session?.access_token, disableRealtime]);

  const safeValue = useMemo(
    () => ({
      connectionState: disableRealtime ? ("disconnected" as ConnectionState) : connectionState,
      sseConnected: disableRealtime ? false : sseConnected,
      isLeader: disableRealtime ? false : isLeader,
      isDegraded: disableRealtime ? false : isDegraded,
      subscribe: (handler: (event: ApplicationUpdatedPayload) => void) => {
        if (disableRealtime) return () => {};
        if (!coordinator) return () => {};
        return coordinator.subscribePresentation(handler);
      },
      reviveApplication: (applicationId: string, nextEpoch: number) => {
        if (disableRealtime) return;
        coordinator?.reviveApplication(applicationId, nextEpoch);
      },
      broadcastRevive: (applicationId: string, nextEpoch: number) => {
        if (disableRealtime) return;
        coordinator?.broadcastRevive(applicationId, nextEpoch);
      },
      hydrate: () => (disableRealtime ? Promise.resolve() : coordinator?.hydrate({ force: true }) ?? Promise.resolve()),
      resetDegraded: () => {
        if (disableRealtime) return;
        coordinator?.resetDegraded();
        void coordinator?.hydrate({ force: true });
      },
    }),
    [disableRealtime, connectionState, sseConnected, isLeader, isDegraded, coordinator]
  );

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

  return <RealtimeContext.Provider value={disableRealtime ? safeValue : value}>{children}</RealtimeContext.Provider>;
}

export { useRealtime } from "./useRealtime";
