import type { ApplicationUpdatedPayload } from "@/services/orchestration/orchestrationRegistry";

export type PresentationListener = (payload: ApplicationUpdatedPayload) => void;

export function createEventBus() {
  const listeners = new Set<PresentationListener>();

  return {
    subscribe(listener: PresentationListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(payload: ApplicationUpdatedPayload) {
      for (const listener of listeners) {
        listener(payload);
      }
    },
    size() {
      return listeners.size;
    },
  };
}
