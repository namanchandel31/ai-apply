const SCHEDULER_STATE = Object.freeze({
  ACTIVE: "active",
  PAUSED: "paused",
  IDLE: "idle",
});

const SEND_QUEUE_ENTRY_STATUS = Object.freeze({
  WAITING: "waiting",
  DISPATCHED: "dispatched",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
});

module.exports = { SCHEDULER_STATE, SEND_QUEUE_ENTRY_STATUS };
