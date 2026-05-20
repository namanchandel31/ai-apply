import { isDebugEnabled, type OrchestrationComponent } from "./debugFlags";
import { flushDedupe, recordDedupe } from "./logDedupe";

type LogMeta = Record<string, unknown>;

function buildPayload(event: string, meta: LogMeta = {}) {
  return { event, ...meta, ts: Date.now() };
}

export function logInfo(event: string, meta: LogMeta = {}) {
  if (import.meta.env.PROD) {
    const allowed = new Set(["SSE_RECONNECTED", "HYDRATION_RETRY"]);
    if (!allowed.has(event)) return;
  }
  // eslint-disable-next-line no-console
  console.info(`[orchestration] ${event}`, buildPayload(event, meta));
}

export function logWarn(event: string, meta: LogMeta = {}) {
  // eslint-disable-next-line no-console
  console.warn(`[orchestration] ${event}`, buildPayload(event, meta));
}

export function logWarnDeduped(
  event: string,
  key: string,
  meta: LogMeta = {}
) {
  recordDedupe("warn", event, key, meta);
  flushDedupe((ev, m) => logWarn(ev, m));
}

export function logError(event: string, meta: LogMeta = {}, err?: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[orchestration] ${event}`, buildPayload(event, meta), err);
}

export function logDebug(
  event: string,
  meta: LogMeta = {},
  component?: OrchestrationComponent
) {
  const comp = component || (meta.component as OrchestrationComponent | undefined);
  if (comp && !isDebugEnabled(comp)) return;
  if (!comp && !import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.debug(`[orchestration] ${event}`, buildPayload(event, meta));
}
