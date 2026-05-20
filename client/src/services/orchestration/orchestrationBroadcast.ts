import type { ApplicationUpdatedPayload } from "./orchestrationRegistry";

export const ORCHESTRATION_CHANNEL = "ai-apply-orchestration";

export type OrchestrationBroadcastPost =
  | { type: "revive"; applicationId: string; orchestrationEpoch: number }
  | { type: "terminal"; applicationId: string }
  | { type: "invalidate"; applicationId?: string }
  | { type: "event"; payload: ApplicationUpdatedPayload }
  | { type: "leader_claim"; ts: number }
  | { type: "leader_release" }
  | { type: "leader_heartbeat"; ts: number }
  | { type: "reconnect_scheduled"; ts: number };

export type OrchestrationBroadcastMessage = OrchestrationBroadcastPost & {
  tabId: string;
};

let tabId: string | null = null;

export function getTabId(): string {
  if (!tabId) {
    tabId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return tabId;
}

export function createOrchestrationBroadcast(
  onMessage: (msg: OrchestrationBroadcastMessage) => void
): { post: (msg: OrchestrationBroadcastPost) => void; close: () => void } | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  const channel = new BroadcastChannel(ORCHESTRATION_CHANNEL);
  channel.onmessage = (ev) => {
    const data = ev.data as OrchestrationBroadcastMessage;
    if (!data || data.tabId === getTabId()) return;
    onMessage(data);
  };
  return {
    post: (msg) => channel.postMessage({ ...msg, tabId: getTabId() }),
    close: () => channel.close(),
  };
}
