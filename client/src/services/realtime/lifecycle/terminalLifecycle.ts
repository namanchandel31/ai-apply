import type { OrchestrationRegistry } from "@/services/orchestration/orchestrationRegistry";

export function handleTerminalTransition(
  registry: OrchestrationRegistry,
  applicationId: string
): void {
  registry.markTerminal(applicationId);
}

export function reviveOrchestration(
  registry: OrchestrationRegistry,
  applicationId: string,
  nextEpoch: number
): void {
  registry.revive(applicationId, nextEpoch);
}
