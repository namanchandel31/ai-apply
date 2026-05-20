import type { ApplicationStatusPayload } from "@/lib/api";

export type OrchestrationState = {
  applicationId: string;
  terminal: boolean;
  pollable: boolean;
  lastVersion: number;
  orchestrationEpoch: number;
  lastUpdatedAt: string;
  backoffUntil: number | null;
  sseSubscribed: boolean;
  lastSequence: number;
  pollAttempts: number;
  pollErrors: number;
  prunedAt: number | null;
};

export type OrchestrationSnapshot = {
  applicationId: string;
  version: number;
  orchestrationEpoch: number;
  updatedAt: string;
  terminal: boolean;
  pollable: boolean;
  uiStatus?: string;
  status?: string;
};

export type ApplicationUpdatedPayload = ApplicationStatusPayload & {
  type?: "application.updated";
  channel?: string;
  applicationId: string;
  userId?: string;
  version?: number;
  orchestrationEpoch?: number;
  updatedAt: string;
};

const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);

export function isTerminalUiStatus(uiStatus: string | undefined): boolean {
  if (!uiStatus) return false;
  return TERMINAL_UI.has(uiStatus.toLowerCase());
}

export function isTerminalState(state: Pick<OrchestrationState, "terminal" | "pollable"> & {
  uiStatus?: string;
  status?: string;
}): boolean {
  if (state.terminal === true) return true;
  const ui = (state as { uiStatus?: string; status?: string }).uiStatus ??
    (state as { status?: string }).status;
  return isTerminalUiStatus(ui);
}

const INACTIVE_TTL_MS = 30 * 60 * 1000;

function defaultState(applicationId: string): OrchestrationState {
  return {
    applicationId,
    terminal: false,
    pollable: true,
    lastVersion: 0,
    orchestrationEpoch: 0,
    lastUpdatedAt: "",
    backoffUntil: null,
    sseSubscribed: true,
    lastSequence: 0,
    pollAttempts: 0,
    pollErrors: 0,
    prunedAt: null,
  };
}

export class OrchestrationRegistry {
  private readonly states = new Map<string, OrchestrationState>();
  private hydrated = false;

  isHydrated(): boolean {
    return this.hydrated;
  }

  resetHydration(): void {
    this.hydrated = false;
  }

  hydrateFromServer(snapshots: OrchestrationSnapshot[]): void {
    const seen = new Set<string>();
    for (const snap of snapshots) {
      seen.add(snap.applicationId);
      const terminal = snap.terminal === true || isTerminalUiStatus(snap.uiStatus);
      const pollable = !terminal && snap.pollable !== false;
      this.states.set(snap.applicationId, {
        applicationId: snap.applicationId,
        terminal,
        pollable,
        lastVersion: snap.version ?? 0,
        orchestrationEpoch: snap.orchestrationEpoch ?? 0,
        lastUpdatedAt: snap.updatedAt ?? "",
        backoffUntil: null,
        sseSubscribed: !terminal,
        lastSequence: 0,
        pollAttempts: 0,
        pollErrors: 0,
        prunedAt: terminal ? Date.now() : null,
      });
      if (terminal) {
        this.clearPollMetadata(snap.applicationId);
      }
    }
    for (const id of [...this.states.keys()]) {
      if (!seen.has(id)) {
        this.states.delete(id);
      }
    }
    this.hydrated = true;
  }

  invalidate(applicationId?: string): void {
    if (applicationId) {
      this.states.delete(applicationId);
      return;
    }
    this.states.clear();
    this.hydrated = false;
  }

  syncFromPresentation(
    apps: Array<{
      id: string;
      terminal?: boolean;
      pollable?: boolean;
      uiStatus?: string;
      status?: string;
      updatedAt?: string;
      createdAt?: string;
    }>
  ): void {
    const seen = new Set<string>();
    for (const app of apps) {
      seen.add(app.id);
      const existing = this.states.get(app.id) ?? defaultState(app.id);
      const terminal = isTerminalState({
        terminal: app.terminal === true,
        pollable: app.pollable !== false,
        uiStatus: app.uiStatus,
        status: app.status,
      });
      const pollable = !terminal && app.pollable !== false;
      this.states.set(app.id, {
        ...existing,
        terminal,
        pollable,
        sseSubscribed: !terminal,
        lastUpdatedAt: app.updatedAt ?? app.createdAt ?? existing.lastUpdatedAt,
      });
      if (terminal) {
        this.markTerminal(app.id);
      }
    }
    for (const id of [...this.states.keys()]) {
      if (!seen.has(id)) {
        this.prune(id);
      }
    }
  }

  upsertFromPoll(patch: ApplicationStatusPayload & { applicationId: string }): boolean {
    const id = patch.applicationId;
    const existing = this.states.get(id) ?? defaultState(id);
    const terminal = patch.terminal === true || isTerminalUiStatus(patch.uiStatus);
    const pollable = !terminal && patch.pollable !== false;

    const next: OrchestrationState = {
      ...existing,
      terminal,
      pollable,
      sseSubscribed: !terminal,
      lastVersion: Math.max(existing.lastVersion, patch.version ?? existing.lastVersion),
      orchestrationEpoch: Math.max(
        existing.orchestrationEpoch,
        patch.orchestrationEpoch ?? existing.orchestrationEpoch
      ),
      lastUpdatedAt: patch.updatedAt ?? existing.lastUpdatedAt,
      prunedAt: terminal ? Date.now() : null,
    };
    this.states.set(id, next);
    if (terminal) {
      this.prune(id);
      return true;
    }
    return false;
  }

  applyAcceptedEvent(event: ApplicationUpdatedPayload): OrchestrationState | null {
    const id = event.applicationId;
    const existing = this.states.get(id) ?? defaultState(id);
    const terminal = event.terminal === true || isTerminalUiStatus(event.uiStatus);
    const pollable = !terminal && event.pollable !== false;

    const next: OrchestrationState = {
      ...existing,
      terminal,
      pollable,
      sseSubscribed: !terminal,
      lastVersion: Math.max(existing.lastVersion, event.version ?? existing.lastVersion),
      orchestrationEpoch: Math.max(
        existing.orchestrationEpoch,
        event.orchestrationEpoch ?? existing.orchestrationEpoch
      ),
      lastUpdatedAt: event.updatedAt || existing.lastUpdatedAt,
      prunedAt: terminal ? Date.now() : null,
    };
    this.states.set(id, next);
    if (terminal) {
      this.prune(id);
    }
    return next;
  }

  get(applicationId: string): OrchestrationState | undefined {
    return this.states.get(applicationId);
  }

  getPollableIds(maxAttempts: number, now = Date.now()): string[] {
    const ids: string[] = [];
    for (const state of this.states.values()) {
      if (state.prunedAt !== null) continue;
      if (state.terminal || !state.pollable) continue;
      if (state.pollAttempts >= maxAttempts) continue;
      if (state.backoffUntil !== null && state.backoffUntil > now) continue;
      ids.push(state.applicationId);
    }
    return ids.sort();
  }

  getPollableIdsKey(maxAttempts: number, now = Date.now()): string {
    return this.getPollableIds(maxAttempts, now).join(",");
  }

  markTerminal(applicationId: string): void {
    const existing = this.states.get(applicationId) ?? defaultState(applicationId);
    this.states.set(applicationId, {
      ...existing,
      terminal: true,
      pollable: false,
      sseSubscribed: false,
      prunedAt: Date.now(),
    });
    this.clearPollMetadata(applicationId);
  }

  revive(applicationId: string, nextEpoch: number): void {
    const existing = this.states.get(applicationId) ?? defaultState(applicationId);
    this.states.set(applicationId, {
      ...existing,
      terminal: false,
      pollable: true,
      sseSubscribed: true,
      orchestrationEpoch: nextEpoch,
      lastVersion: existing.lastVersion,
      pollAttempts: 0,
      pollErrors: 0,
      backoffUntil: null,
      prunedAt: null,
    });
  }

  prune(applicationId: string): void {
    const existing = this.states.get(applicationId);
    if (!existing) return;
    this.states.set(applicationId, {
      ...existing,
      terminal: true,
      pollable: false,
      sseSubscribed: false,
      prunedAt: Date.now(),
    });
    this.clearPollMetadata(applicationId);
  }

  clearPollMetadata(applicationId: string): void {
    const existing = this.states.get(applicationId);
    if (!existing) return;
    this.states.set(applicationId, {
      ...existing,
      pollAttempts: 0,
      pollErrors: 0,
      backoffUntil: null,
    });
  }

  recordPollAttempt(applicationId: string): void {
    const existing = this.states.get(applicationId);
    if (!existing || existing.prunedAt !== null) return;
    existing.pollAttempts += 1;
  }

  recordPollError(applicationId: string, backoffUntil: number): void {
    const existing = this.states.get(applicationId);
    if (!existing || existing.prunedAt !== null) return;
    existing.pollErrors += 1;
    existing.backoffUntil = backoffUntil;
  }

  clearPollError(applicationId: string): void {
    const existing = this.states.get(applicationId);
    if (!existing) return;
    existing.pollErrors = 0;
    existing.backoffUntil = null;
  }

  evictInactive(now = Date.now()): number {
    let evicted = 0;
    for (const [id, state] of this.states) {
      if (!state.terminal || state.prunedAt === null) continue;
      if (now - state.prunedAt > INACTIVE_TTL_MS) {
        this.states.delete(id);
        evicted += 1;
      }
    }
    return evicted;
  }
}

export const globalOrchestrationRegistry = new OrchestrationRegistry();
