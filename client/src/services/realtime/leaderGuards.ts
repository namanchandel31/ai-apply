import { logDebug } from "@/services/logging/orchestrationLogger";
import { isDebugEnabled } from "@/services/logging/debugFlags";

export type LeaderOnlyOperation =
  | "connect"
  | "hydrate"
  | "heal"
  | "replay"
  | "tier2_fetch"
  | "broadcast_post";

export function assertLeaderOnly(isLeader: boolean, op: LeaderOnlyOperation): boolean {
  if (isLeader) return true;
  if (isDebugEnabled("leader")) {
    logDebug("LEADER_OWNERSHIP_VIOLATION", { operation: op, component: "leader" }, "leader");
  }
  return false;
}
