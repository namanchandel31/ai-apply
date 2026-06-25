import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/auth/AuthContext";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";
import { getRealtimeTransportManager } from "@/services/realtime/RealtimeTransportManager";
import { useRealtimeProviderSession } from "@/hooks/useRealtimeProviderSession";
import { createRealtimeContextValue } from "@/contexts/createRealtimeContextValue";
import {
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

  const connectionState = useSyncExternalStore(
    subscribeTransportState,
    getTransportSnapshot,
    () => "disconnected" as ConnectionState
  );

  const { coordinator, isLeader, isDegraded } = useRealtimeProviderSession({
    queryClient,
    isResolved,
    isAuthenticated,
    session,
    getTransportState: getTransportSnapshot,
  });

  const value = useMemo(
    () =>
      createRealtimeContextValue({
        connectionState,
        isLeader,
        isDegraded,
        coordinator,
      }),
    [connectionState, isLeader, isDegraded, coordinator]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export { useRealtime } from "./useRealtime";
