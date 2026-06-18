const { UI_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

const VISIBLE_UI = new Set([
  UI_STATUS.DRAFT,
  UI_STATUS.QUEUED,
  UI_STATUS.PROCESSING,
  UI_STATUS.RETRYING,
  UI_STATUS.GENERATED,
  UI_STATUS.SENT,
  UI_STATUS.FAILED,
  UI_STATUS.NEEDS_REVIEW,
  UI_STATUS.CANCELLED,
  "draft",
  "queued",
  "processing",
  "retrying",
  "generated",
  "sent",
  "failed",
  "needs_review",
  "cancelled",
]);

function isVisibleUiStatus(uiStatus) {
  if (!uiStatus) return false;
  return VISIBLE_UI.has(String(uiStatus).toLowerCase());
}

function isUserVisibleTransition(prev, next) {
  const p = prev?.uiStatus ?? prev?.status;
  const n = next?.uiStatus ?? next?.status;
  if (!isVisibleUiStatus(n)) return false;
  return p !== n;
}

/**
 * @param {{ version: number, epoch: number, uiStatus?: string, status?: string }} meta
 * @param {{ uiStatus?: string, status?: string, terminal?: boolean }} serialized
 * @param {{ version: number, epoch: number, uiStatus?: string } | undefined} lastPublished
 * @param {{ forceRevive?: boolean, enteringTerminal?: boolean }} options
 */
function isPublishWorthy(meta, serialized, lastPublished, options = {}) {
  if (options.forceRevive || options.enteringTerminal) return true;

  const uiStatus = serialized.uiStatus || serialized.status;
  if (!isVisibleUiStatus(uiStatus)) return false;

  if (!lastPublished) return true;

  const versionMoved =
    meta.version !== lastPublished.version || meta.epoch !== lastPublished.epoch;
  if (versionMoved) return true;

  const visibleChanged =
    (lastPublished.uiStatus ?? lastPublished.status) !== uiStatus;
  return visibleChanged;
}

module.exports = {
  VISIBLE_UI,
  isVisibleUiStatus,
  isUserVisibleTransition,
  isPublishWorthy,
};
