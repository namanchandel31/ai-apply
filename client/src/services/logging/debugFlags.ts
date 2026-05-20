export type OrchestrationComponent =
  | "realtime"
  | "reconciliation"
  | "hydration"
  | "transport"
  | "leader"
  | "poll";

const COMPONENT_ENV: Record<OrchestrationComponent, string> = {
  realtime: "VITE_DEBUG_ORCHESTRATION_REALTIME",
  reconciliation: "VITE_DEBUG_ORCHESTRATION_RECONCILIATION",
  hydration: "VITE_DEBUG_ORCHESTRATION_HYDRATION",
  transport: "VITE_DEBUG_ORCHESTRATION_TRANSPORT",
  leader: "VITE_DEBUG_ORCHESTRATION_LEADER",
  poll: "VITE_DEBUG_ORCHESTRATION_POLL",
};

function truthy(val: unknown): boolean {
  if (val == null) return false;
  const s = String(val).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function isDebugEnabled(component: OrchestrationComponent): boolean {
  const key = COMPONENT_ENV[component];
  return truthy(import.meta.env[key as keyof ImportMetaEnv]);
}
