import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";
import type { RealtimeCoordinator } from "@/services/realtime/realtimeCoordinator";

export type RealtimeContextValue = {
  connectionState: ConnectionState;
  sseConnected: boolean;
  isLeader: boolean;
  isDegraded: boolean;
  subscribe: (handler: (event: ApplicationUpdatedPayload) => void) => () => void;
  reviveApplication: (applicationId: string, nextEpoch: number) => void;
  broadcastRevive: (applicationId: string, nextEpoch: number) => void;
  hydrate: () => Promise<void>;
  resetDegraded: () => void;
};

type BuildArgs = {
  connectionState: ConnectionState;
  isLeader: boolean;
  isDegraded: boolean;
  coordinator: RealtimeCoordinator | null;
};

export function createRealtimeContextValue({
  connectionState,
  isLeader,
  isDegraded,
  coordinator,
}: BuildArgs): RealtimeContextValue {
  const sseConnected = connectionState === "connected" && isLeader;

  if (!coordinator) {
    return {
      connectionState: "disconnected",
      sseConnected: false,
      isLeader: false,
      isDegraded: false,
      subscribe: () => () => {},
      reviveApplication: () => {},
      broadcastRevive: () => {},
      hydrate: () => Promise.resolve(),
      resetDegraded: () => {},
    };
  }

  return {
    connectionState,
    sseConnected,
    isLeader,
    isDegraded,
    subscribe: (handler) => coordinator.subscribePresentation(handler),
    reviveApplication: (applicationId, nextEpoch) => {
      coordinator.reviveApplication(applicationId, nextEpoch);
    },
    broadcastRevive: (applicationId, nextEpoch) => {
      coordinator.broadcastRevive(applicationId, nextEpoch);
    },
    hydrate: () => coordinator.hydrate({ force: true }),
    resetDegraded: () => {
      coordinator.resetDegraded();
      void coordinator.hydrate({ force: true });
    },
  };
}
