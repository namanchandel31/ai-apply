/** Coalesce by applicationId; latest orchestration version wins (not eventId). */
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { EVENT_BATCH_FLUSH_MS } from "../reconnectRecoveryConfig";
import {
  MAX_BATCH_COALESCE_MAP,
  MAX_LIVE_QUEUE_EVENTS,
  QUEUE_PRESSURE_RATIO,
} from "../realtimeQueueLimits";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { isDebugEnabled } from "@/services/logging/debugFlags";

function pickNewer(
  a: ApplicationUpdatedPayload,
  b: ApplicationUpdatedPayload
): ApplicationUpdatedPayload {
  const av = a.version ?? 0;
  const bv = b.version ?? 0;
  if (bv !== av) return bv > av ? b : a;
  const ae = a.orchestrationEpoch ?? 0;
  const be = b.orchestrationEpoch ?? 0;
  if (be !== ae) return be > ae ? b : a;
  const at = a.updatedAt ?? "";
  const bt = b.updatedAt ?? "";
  return bt >= at ? b : a;
}

export type EventBatchProcessor = {
  enqueue: (payload: ApplicationUpdatedPayload) => void;
  flushNow: () => ApplicationUpdatedPayload[];
  setPaused: (paused: boolean) => void;
  getPendingCount: () => number;
  destroy: () => void;
};

export function createEventBatchProcessor(
  onFlush: (payloads: ApplicationUpdatedPayload[]) => void
): EventBatchProcessor {
  const pending = new Map<string, ApplicationUpdatedPayload>();
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let coalescedTotal = 0;

  const scheduleFlush = () => {
    if (timer || paused) return;
    timer = setTimeout(() => {
      timer = null;
      flushInternal();
    }, EVENT_BATCH_FLUSH_MS);
  };

  const compactOverflow = () => {
    if (pending.size <= MAX_BATCH_COALESCE_MAP) return;
    const entries = [...pending.entries()];
    pending.clear();
    for (const [id, p] of entries) {
      const existing = pending.get(id);
      pending.set(id, existing ? pickNewer(existing, p) : p);
    }
    logDebug(
      "REALTIME_QUEUE_OVERFLOW",
      { size: entries.length, cap: MAX_BATCH_COALESCE_MAP },
      "reconciliation"
    );
  };

  const flushInternal = () => {
    if (!pending.size) return;
    const started = performance.now();
    const payloads = [...pending.values()];
    const size = payloads.length;
    const droppedIntermediateCount = coalescedTotal;
    pending.clear();
    onFlush(payloads);
    const durationMs = Math.round(performance.now() - started);
    if (isDebugEnabled("reconciliation")) {
      logDebug(
        "BATCH_FLUSH",
        {
          coalescedEventCount: size,
          droppedIntermediateCount,
          coalesced: coalescedTotal,
          flushDurationMs: durationMs,
          durationMs,
        },
        "reconciliation"
      );
    }
    coalescedTotal = 0;
  };

  return {
    enqueue(payload: ApplicationUpdatedPayload) {
      if (paused) return;

      const depth = pending.size;
      if (depth >= MAX_LIVE_QUEUE_EVENTS * QUEUE_PRESSURE_RATIO) {
        logDebug("REALTIME_QUEUE_PRESSURE", { depth, max: MAX_LIVE_QUEUE_EVENTS }, "reconciliation");
      }

      const id = payload.applicationId;
      const existing = pending.get(id);
      if (existing) {
        coalescedTotal += 1;
        pending.set(id, pickNewer(existing, payload));
      } else {
        pending.set(id, payload);
      }

      if (pending.size > MAX_LIVE_QUEUE_EVENTS) {
        compactOverflow();
      }
      scheduleFlush();
    },
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const payloads = [...pending.values()];
      pending.clear();
      return payloads;
    },
    setPaused(p: boolean) {
      paused = p;
      if (!paused && pending.size) scheduleFlush();
    },
    getPendingCount() {
      return pending.size;
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
