import type { QueryClient } from "@tanstack/react-query";
import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";
import { EVENT_BATCH_FLUSH_MS } from "../reconnectRecoveryConfig";
import { applyRealtimeEventsToCache } from "./applicationCacheSync";

const IMMEDIATE_FLUSH_UI = new Set(["queued_sending", "sending", "sent"]);

/** Coalesce presentation events into one list cache write per flush window. */
export function createRealtimeCacheUpdateBatcher(queryClient: QueryClient) {
  const pending: ApplicationUpdatedPayload[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending.length) return;
    const batch = pending.splice(0, pending.length);
    applyRealtimeEventsToCache(queryClient, batch);
  };

  return {
    enqueue(event: ApplicationUpdatedPayload) {
      pending.push(event);
      const ui = (event.uiStatus || event.status || "").toLowerCase();
      if (IMMEDIATE_FLUSH_UI.has(ui)) {
        flush();
        return;
      }
      if (timer) return;
      timer = setTimeout(flush, EVENT_BATCH_FLUSH_MS);
    },
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.length = 0;
    },
  };
}
