const TERMINAL_UI = new Set(["sent", "failed", "cancelled", "needs_review"]);
const ACTIVE_UI = new Set(["processing", "sending", "queued", "retrying"]);

function isTerminalUiStatus(uiStatus) {
  if (!uiStatus) return false;
  return TERMINAL_UI.has(String(uiStatus).toLowerCase());
}

function shouldApplyOrchestrationEvent(registry, event) {
  const eventVersion = event.version ?? 0;
  const eventEpoch = event.orchestrationEpoch ?? 0;

  if (!registry) return { apply: true };

  if (eventVersion < registry.lastVersion) {
    return { apply: false, reason: "stale_version" };
  }
  if (eventEpoch < registry.orchestrationEpoch) {
    return { apply: false, reason: "stale_epoch" };
  }

  if (registry.terminal) {
    const passiveReactivation =
      event.pollable === true ||
      ACTIVE_UI.has(event.uiStatus) ||
      (!event.terminal && !isTerminalUiStatus(event.uiStatus));
    if (passiveReactivation && eventEpoch <= registry.orchestrationEpoch) {
      return { apply: false, reason: "terminal_resurrection" };
    }
  }

  if (registry.prunedAt != null && eventEpoch <= registry.orchestrationEpoch) {
    return { apply: false, reason: "pruned" };
  }

  return { apply: true };
}

function shouldApplyDisplayEventTieBreak(registry, event) {
  if (!registry) return { apply: true };
  const eventVersion = event.version ?? 0;
  const eventEpoch = event.orchestrationEpoch ?? 0;
  if (
    event.updatedAt &&
    registry.lastUpdatedAt &&
    eventVersion === registry.lastVersion &&
    eventEpoch === registry.orchestrationEpoch &&
    event.updatedAt < registry.lastUpdatedAt
  ) {
    return { apply: false, reason: "stale_updated_at" };
  }
  return { apply: true };
}

function shouldApplyOrchestrationRowPatch(existing, event, registryEpoch = 0) {
  const incomingUi = (event.uiStatus || event.status || "").trim();
  const incomingStatus = (event.status || "").trim();
  if (!incomingUi && !incomingStatus) {
    return { apply: false, reason: "empty_status" };
  }
  if (!existing) return { apply: true };

  const existingUi = existing.uiStatus || existing.status;
  if (
    isTerminalUiStatus(existingUi) &&
    !isTerminalUiStatus(incomingUi || incomingStatus)
  ) {
    const eventEpoch = event.orchestrationEpoch ?? 0;
    if (eventEpoch <= registryEpoch) {
      return { apply: false, reason: "terminal_downgrade" };
    }
  }
  return { apply: true };
}

function orchPatchFromEvent(event, existing, registryEpoch = 0) {
  const rowCheck = shouldApplyOrchestrationRowPatch(existing, event, registryEpoch);
  if (!rowCheck.apply) return {};

  const patch = {};
  const status = (event.status || "").trim();
  const uiStatus = (event.uiStatus || event.status || "").trim();
  if (status) patch.status = event.status;
  if (uiStatus) patch.uiStatus = event.uiStatus || event.status;
  if (event.terminal !== undefined) patch.terminal = event.terminal;
  if (event.executionTerminal !== undefined) patch.executionTerminal = event.executionTerminal;
  if (event.pollable !== undefined) patch.pollable = event.pollable;
  if (event.canRetry !== undefined) patch.canRetry = event.canRetry;
  if (event.canContinue !== undefined) patch.canContinue = event.canContinue;
  if (event.reviewReason !== undefined) patch.reviewReason = event.reviewReason ?? undefined;
  if (event.updatedAt) patch.updatedAt = event.updatedAt;
  return patch;
}

function shouldApplyDisplayPatch(existing, incoming) {
  if (!existing?.updatedAt) return true;
  if (!incoming.updatedAt) return false;
  return incoming.updatedAt >= existing.updatedAt;
}

function mergeDisplayFields(existing, incoming) {
  if (!shouldApplyDisplayPatch(existing, incoming)) return {};
  const patch = {};
  if (incoming.updatedAt) patch.updatedAt = incoming.updatedAt;
  if (incoming.role != null && String(incoming.role).trim() !== "") patch.role = incoming.role;
  if (incoming.company != null && String(incoming.company).trim() !== "") {
    patch.company = incoming.company;
  }
  if (incoming.jdEnrichment !== undefined) patch.jdEnrichment = incoming.jdEnrichment;
  return patch;
}

function mergeCachePatch(existing, event, registryEpoch = 0) {
  const orch = orchPatchFromEvent(event, existing, registryEpoch);
  const display = mergeDisplayFields(existing ?? {}, {
    role: event.role,
    company: event.company,
    jdEnrichment: event.jdEnrichment,
    updatedAt: event.updatedAt,
  });
  return { ...orch, ...display };
}

function mergePartialWithListRow(partial, authoritative) {
  const fields = [
    "status",
    "uiStatus",
    "terminal",
    "executionTerminal",
    "pollable",
    "canRetry",
    "canContinue",
    "reviewReason",
    "updatedAt",
    "role",
    "company",
    "jdEnrichment",
  ];
  const merged = { ...partial };
  for (const key of fields) {
    if (authoritative[key] !== undefined) merged[key] = authoritative[key];
  }
  delete merged._partial;
  return merged;
}

module.exports = {
  isTerminalUiStatus,
  shouldApplyOrchestrationEvent,
  shouldApplyDisplayEventTieBreak,
  shouldApplyOrchestrationRowPatch,
  orchPatchFromEvent,
  shouldApplyDisplayPatch,
  mergeDisplayFields,
  mergeCachePatch,
  mergePartialWithListRow,
};
