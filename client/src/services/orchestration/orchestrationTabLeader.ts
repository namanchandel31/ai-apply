import { getTabId } from "./orchestrationBroadcast";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";

const LEASE_KEY = "ai-apply-orchestration-leader";
const LEASE_TTL_MS = 5000;
const HEARTBEAT_MS = 2000;

export type TabLeaderCallbacks = {
  onBecomeLeader: () => void;
  onLoseLeadership: () => void;
};

function readLease(): { tabId: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { tabId: string; expiresAt: number };
  } catch {
    return null;
  }
}

function writeLease(tabId: string): void {
  localStorage.setItem(
    LEASE_KEY,
    JSON.stringify({ tabId, expiresAt: Date.now() + LEASE_TTL_MS })
  );
}

export function createTabLeader(callbacks: TabLeaderCallbacks) {
  let isLeader = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let watchTimer: ReturnType<typeof setInterval> | null = null;

  const tryClaim = () => {
    const lease = readLease();
    const now = Date.now();
    const id = getTabId();
    if (!lease || lease.expiresAt < now || lease.tabId === id) {
      writeLease(id);
      if (!isLeader) {
        isLeader = true;
        logDebug("TAB_LEADER_CLAIMED", { tabId: id }, "leader");
        callbacks.onBecomeLeader();
      }
      return true;
    }
    if (isLeader && lease.tabId !== id) {
      isLeader = false;
      metrics.increment("orchestration.leader.conflict");
      logDebug("TAB_LEADER_LOST", { tabId: id, holder: lease.tabId }, "leader");
      callbacks.onLoseLeadership();
    }
    return isLeader;
  };

  const start = () => {
    tryClaim();
    heartbeatTimer = setInterval(() => {
      if (isLeader) writeLease(getTabId());
    }, HEARTBEAT_MS);
    watchTimer = setInterval(tryClaim, HEARTBEAT_MS);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEASE_KEY) tryClaim();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (watchTimer) clearInterval(watchTimer);
      window.removeEventListener("storage", onStorage);
      if (isLeader) {
        const lease = readLease();
        if (lease?.tabId === getTabId()) localStorage.removeItem(LEASE_KEY);
        isLeader = false;
        callbacks.onLoseLeadership();
      }
    };
  };

  return { start, isLeader: () => isLeader, tryClaim };
}

/** Pure lease logic for tests */
export function shouldHoldLease(
  lease: { tabId: string; expiresAt: number } | null,
  myTabId: string,
  now: number
): boolean {
  if (!lease || lease.expiresAt < now) return true;
  return lease.tabId === myTabId;
}
