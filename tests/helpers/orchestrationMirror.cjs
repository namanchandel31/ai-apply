const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);
const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying"]);

function isTerminalUiStatus(uiStatus) {
  if (!uiStatus) return false;
  return TERMINAL_UI.has(String(uiStatus).toLowerCase());
}

function shouldApplyEvent(registry, event) {
  const eventVersion = event.version ?? 0;
  const eventEpoch = event.orchestrationEpoch ?? 0;
  const lastVersion = registry?.lastVersion ?? 0;
  const lastEpoch = registry?.orchestrationEpoch ?? 0;
  const lastUpdatedAt = registry?.lastUpdatedAt ?? "";

  if (eventVersion < lastVersion) {
    return { apply: false, reason: "stale_version" };
  }
  if (eventEpoch < lastEpoch) {
    return { apply: false, reason: "stale_epoch" };
  }
  if (
    event.updatedAt &&
    lastUpdatedAt &&
    eventVersion === lastVersion &&
    eventEpoch === lastEpoch &&
    event.updatedAt < lastUpdatedAt
  ) {
    return { apply: false, reason: "stale_updated_at" };
  }

  if (registry?.terminal) {
    const passiveReactivation =
      event.pollable === true ||
      ACTIVE_UI.has(event.uiStatus) ||
      (!event.terminal && !isTerminalUiStatus(event.uiStatus));
    if (passiveReactivation && eventEpoch <= lastEpoch) {
      return { apply: false, reason: "terminal_resurrection" };
    }
  }

  if (registry?.prunedAt != null && eventEpoch <= lastEpoch) {
    return { apply: false, reason: "pruned" };
  }

  return { apply: true };
}

function defaultState(applicationId) {
  return {
    applicationId,
    terminal: false,
    pollable: true,
    lastVersion: 0,
    orchestrationEpoch: 0,
    lastUpdatedAt: "",
    backoffUntil: null,
    sseSubscribed: true,
    pollAttempts: 0,
    pollErrors: 0,
    prunedAt: null,
  };
}

class OrchestrationRegistry {
  constructor() {
    this.states = new Map();
  }

  get(id) {
    return this.states.get(id);
  }

  markTerminal(id) {
    const existing = this.states.get(id) ?? defaultState(id);
    this.states.set(id, {
      ...existing,
      terminal: true,
      pollable: false,
      sseSubscribed: false,
      prunedAt: Date.now(),
      pollAttempts: 0,
      pollErrors: 0,
      backoffUntil: null,
    });
  }

  revive(id, nextEpoch) {
    const existing = this.states.get(id) ?? defaultState(id);
    this.states.set(id, {
      ...existing,
      terminal: false,
      pollable: true,
      sseSubscribed: true,
      orchestrationEpoch: nextEpoch,
      pollAttempts: 0,
      pollErrors: 0,
      backoffUntil: null,
      prunedAt: null,
    });
  }

  applyAcceptedEvent(event) {
    const id = event.applicationId;
    const existing = this.states.get(id) ?? defaultState(id);
    const terminal = event.terminal === true || isTerminalUiStatus(event.uiStatus);
    const pollable = !terminal && event.pollable !== false;
    const next = {
      ...existing,
      terminal,
      pollable,
      lastVersion: Math.max(existing.lastVersion, event.version ?? 0),
      orchestrationEpoch: Math.max(existing.orchestrationEpoch, event.orchestrationEpoch ?? 0),
      lastUpdatedAt: event.updatedAt || existing.lastUpdatedAt,
      prunedAt: terminal ? Date.now() : null,
    };
    this.states.set(id, next);
    if (terminal) this.markTerminal(id);
    return next;
  }

  getPollableIds(maxAttempts, now = Date.now()) {
    const ids = [];
    for (const state of this.states.values()) {
      if (state.prunedAt != null) continue;
      if (state.terminal || !state.pollable) continue;
      if (state.pollAttempts >= maxAttempts) continue;
      if (state.backoffUntil != null && state.backoffUntil > now) continue;
      ids.push(state.applicationId);
    }
    return ids.sort();
  }
}

module.exports = {
  shouldApplyEvent,
  OrchestrationRegistry,
  isTerminalUiStatus,
};
