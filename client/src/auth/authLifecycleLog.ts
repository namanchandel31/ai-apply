/** Dev-only structured auth lifecycle logs (no tokens). */
const enabled = import.meta.env.DEV;

export function logAuthLifecycle(
  event: string,
  detail?: Record<string, string | boolean | number | null | undefined>
) {
  if (!enabled) return;
  console.info(`[auth] ${event}`, detail ?? {});
}
