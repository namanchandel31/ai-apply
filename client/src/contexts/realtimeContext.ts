import { createContext } from "react";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import type { ConnectionState } from "@/services/realtime/transport/sseTransport";

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

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
