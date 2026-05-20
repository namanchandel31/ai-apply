import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import {
  createRealtimeCoordinator,
  type RealtimeCoordinator,
} from "@/services/realtime/realtimeCoordinator";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";

type RealtimeContextValue = {
  connectionState: ConnectionState;
  sseConnected: boolean;
  isLeader: boolean;
  subscribe: (handler: (event: ApplicationUpdatedPayload) => void) => () => void;
  reviveApplication: (applicationId: string, nextEpoch: number) => void;
  broadcastRevive: (applicationId: string, nextEpoch: number) => void;
  hydrate: () => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isLeader, setIsLeader] = useState(false);
  const coordinatorRef = useRef<RealtimeCoordinator | null>(null);

  if (!coordinatorRef.current) {
    coordinatorRef.current = createRealtimeCoordinator((s) => {
      setConnectionState(s);
      setIsLeader(coordinatorRef.current?.isLeader() ?? false);
    });
  }

  const subscribe = useCallback((handler: (event: ApplicationUpdatedPayload) => void) => {
    return coordinatorRef.current!.subscribePresentation(handler);
  }, []);

  const reviveApplication = useCallback((applicationId: string, nextEpoch: number) => {
    coordinatorRef.current!.reviveApplication(applicationId, nextEpoch);
  }, []);

  const broadcastRevive = useCallback((applicationId: string, nextEpoch: number) => {
    coordinatorRef.current!.broadcastRevive(applicationId, nextEpoch);
  }, []);

  const hydrate = useCallback(() => {
    return coordinatorRef.current!.hydrate();
  }, []);

  useEffect(() => {
    if (!api.getToken()) {
      coordinatorRef.current?.disconnect();
      return;
    }

    const stop = coordinatorRef.current?.start();
    const id = setInterval(() => {
      setIsLeader(coordinatorRef.current?.isLeader() ?? false);
    }, 1000);

    return () => {
      clearInterval(id);
      stop?.();
      coordinatorRef.current?.disconnect();
    };
  }, []);

  const sseConnected = connectionState === "connected" && isLeader;

  const value = useMemo(
    () => ({
      connectionState,
      sseConnected,
      isLeader,
      subscribe,
      reviveApplication,
      broadcastRevive,
      hydrate,
    }),
    [connectionState, sseConnected, isLeader, subscribe, reviveApplication, broadcastRevive, hydrate]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
}
