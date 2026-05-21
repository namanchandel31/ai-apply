import { getTabId } from "@/services/orchestration/orchestrationBroadcast";

const KEY_PREFIX = "ai-apply-last-event-id";

function storageKey(): string {
  return `${KEY_PREFIX}:${getTabId()}`;
}

export function getLastEventId(): string | null {
  try {
    return sessionStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

export function setLastEventId(eventId: string): void {
  if (!eventId) return;
  try {
    sessionStorage.setItem(storageKey(), eventId);
  } catch {
    // ignore quota errors
  }
}

export function clearLastEventId(): void {
  try {
    sessionStorage.removeItem(storageKey());
  } catch {
    // ignore
  }
}
