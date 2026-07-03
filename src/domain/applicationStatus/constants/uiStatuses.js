const UI_STATUS = {
  DRAFT: "draft",
  QUEUED: "queued",
  QUEUED_SENDING: "queued_sending",
  PROCESSING: "processing",
  SENDING: "sending",
  GENERATED: "generated",
  NEEDS_REVIEW: "needs_review",
  RETRYING: "retrying",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const TERMINAL_UI_STATUSES = new Set([
  UI_STATUS.SENT,
  UI_STATUS.FAILED,
  UI_STATUS.CANCELLED,
]);

const APPLICATION_STATUS = {
  DRAFT: "draft",
  GENERATED: "generated",
  NEEDS_REVIEW: "needs_review",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const JOB_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  RETRYING: "retrying",
  COMPLETED: "completed",
  FAILED: "failed",
};

const ACTIVE_JOB_STATUSES = new Set([
  JOB_STATUS.QUEUED,
  JOB_STATUS.PROCESSING,
  JOB_STATUS.RETRYING,
]);

module.exports = {
  UI_STATUS,
  TERMINAL_UI_STATUSES,
  APPLICATION_STATUS,
  JOB_STATUS,
  ACTIVE_JOB_STATUSES,
};
