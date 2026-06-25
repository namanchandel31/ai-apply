import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { logAuthLifecycle } from "@/auth/authLifecycleLog";
import {
  applicationsQueryOptions,
  setupStatusQueryOptions,
} from "@/queries/bootstrapQueries";
import { bindCacheSyncToCoordinator } from "@/services/realtime/realtimeCacheSession";
import { getRealtimeTransportManager } from "@/services/realtime/RealtimeTransportManager";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";
import type { RealtimeCoordinator } from "@/services/realtime/realtimeCoordinator";
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

type SessionArgs = {
  queryClient: QueryClient;
  isResolved: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  getTransportState: () => ConnectionState;
};

export function useRealtimeProviderSession({
  queryClient,
  isResolved,
  isAuthenticated,
  session,
  getTransportState,
}: SessionArgs) {
  const coordinator = getSharedCoordinatorRef();
  const [isLeader, setIsLeader] = useState(() => coordinator?.isLeader() ?? false);

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

    const leaderPoll = setInterval(() => {
      const next = getSharedCoordinatorRef()?.isLeader() ?? false;
      setIsLeader((prev) => (prev === next ? prev : next));
    }, 3000);

    return () => {
      clearInterval(leaderPoll);
      removeListener();
    };
  }, [queryClient, isResolved, isAuthenticated, session?.access_token]);

  useEffect(() => {
    const activeCoordinator = getSharedCoordinatorRef();
    if (!session?.access_token || !activeCoordinator || isCacheSyncBound()) return;
    markCacheSyncBound();
    return bindCacheSyncToCoordinator(queryClient, activeCoordinator, () => ({
      isLeader: activeCoordinator.isLeader(),
      sseConnected: getTransportState() === "connected" && activeCoordinator.isLeader(),
      connectionState: getTransportState(),
    }));
  }, [queryClient, session?.access_token, getTransportState]);

  return {
    coordinator: getSharedCoordinatorRef(),
    isLeader,
    isDegraded: getSharedCoordinatorRef()?.isDegraded() ?? false,
  };
}

export type { RealtimeCoordinator };
