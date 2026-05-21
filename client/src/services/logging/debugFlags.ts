import loggingConfig from "@/config/logging.config";

export type OrchestrationComponent =
  | "realtime"
  | "reconciliation"
  | "hydration"
  | "transport"
  | "leader"
  | "poll"
  | "cache";

/** Frozen allowlist: orchestration | query | llm — parsed from VITE_DEBUG */
export function isDebugEnabled(_component?: OrchestrationComponent): boolean {
  return loggingConfig.isOrchestrationDebugEnabled(_component);
}
