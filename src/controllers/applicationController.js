const {
  listApplicationsPaginated,
  getApplicationById,
  getApplicationStatusBundle,
  getApplicationStatusSnapshot,
} = require("../models/applicationModel");
const { getApplicationStatusForPoll } = require("../services/applicationStatusForPoll");
const { pool, getPoolMetrics } = require("../db");
const { orchestrationDedupe } = require("../utils/logDedupe");
const { metrics } = require("../observability/orchestrationMetrics");
const { getJobById } = require("../models/applicationJobModel");
const { validateApplicationsListQuery } = require("../schemas/validateApplicationsListQuery");
const { serializeApplicationsListResult } = require("../services/applicationListSerializer");
const { serializeApplicationDetail } = require("../services/applicationDetailSerializer");
const { listEventsForApplication } = require("../models/applicationEventModel");
const {
  buildStatusFingerprint,
  buildSnapshotFingerprint,
  computeStatusEtag,
  etagMatches,
  parseIfNoneMatch,
} = require("../services/applicationStatusEtag");
const {
  continueApplication,
  retryApplication,
  cancelApplication,
  patchApplicationEmail,
} = require("../services/applicationCommandService");
const { ok, ERROR_CODES } = require("../utils/response");
const { sendError } = require("../utils/httpErrorResponse");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

const CLIENT_ERROR_MESSAGES = {
  NOT_FOUND: "Application not found",
  INVALID_EMAIL: "Invalid contact email format",
  INVALID_STATE: "Operation not allowed in current state",
  BAD_REQUEST: "Invalid request",
  DUPLICATE_CONTINUE: "Duplicate continue request",
  SEND_ALREADY_IN_FLIGHT: "Send already in progress",
  ALREADY_SENT: "Application already sent",
  STATE_TRANSITION_CONFLICT: "State transition conflict",
  RETRY_ALREADY_IN_FLIGHT: "A retry is already in progress",
};

function handleCommandError(res, err, req) {
  const map = {
    NOT_FOUND: 404,
    INVALID_EMAIL: 400,
    INVALID_STATE: 409,
    BAD_REQUEST: 400,
    DUPLICATE_CONTINUE: 409,
    SEND_ALREADY_IN_FLIGHT: 409,
    ALREADY_SENT: 409,
    STATE_TRANSITION_CONFLICT: 409,
    RETRY_ALREADY_IN_FLIGHT: 409,
  };
  const status = map[err.code] || 500;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;
  const message =
    status < 500
      ? CLIENT_ERROR_MESSAGES[err.code] || "Request could not be completed"
      : "An internal error occurred.";

  if (status >= 500) {
    logError("APPLICATION_COMMAND_ERROR", err, buildLogContext({
      reqId: req.requestId,
      userId: req.user?.id,
      applicationId: req.params?.id,
      route: req.originalUrl,
      method: req.method,
    }));
  }

  return sendError(res, {
    status,
    code,
    message,
    retryable: status >= 500,
  });
}

const listApplicationsController = async (req, res) => {
  try {
    const validated = validateApplicationsListQuery(req.query);
    if (!validated.ok) {
      const message = validated.error.issues.map((i) => i.message).join("; ") || "Invalid query";
      return sendError(res, {
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message,
        retryable: false,
      });
    }

    const { rows } = await listApplicationsPaginated(req.user.id, validated.data);
    const data = serializeApplicationsListResult(rows, validated.data);
    return ok(res, data);
  } catch (err) {
    logError("GET_APPLICATIONS_ERROR", err, buildLogContext({ userId: req.user.id }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to list applications",
      retryable: false,
    });
  }
};

const getApplicationController = async (req, res) => {
  try {
    const row = await getApplicationById(req.params.id, req.user.id);
    if (!row) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Application not found",
        retryable: false,
      });
    }
    const events = await listEventsForApplication(req.params.id, 50);
    const detail = serializeApplicationDetail(row);
    detail.events = events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      actorType: e.actor_type,
      actorId: e.actor_id,
      metadata: e.metadata,
      createdAt: e.created_at,
    }));
    return ok(res, detail);
  } catch (err) {
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to fetch application",
      retryable: false,
    });
  }
};

function logStatusPollEvent(durationMs, bundleQueryMs, payload) {
  metrics.histogram("orchestration.poll.duration_ms", durationMs, {
    fastPath: payload.fastPath || "bundle",
  });
  if (payload.fastPath === "terminal") return;
  const base = { ...payload, durationMs, bundleQueryMs, component: "poll" };
  if (durationMs > 500) {
    orchestrationDedupe.record("warn", "STATUS_POLL_CRITICAL", payload.applicationId, base);
  } else if (durationMs > 250) {
    orchestrationDedupe.record("warn", "STATUS_POLL_SLOW", payload.applicationId, base);
  } else if (bundleQueryMs > 100) {
    orchestrationDedupe.record("warn", "STATUS_POLL_SLOW_DB", payload.applicationId, base);
  }
  orchestrationDedupe.flush();
}

const getApplicationStatusController = async (req, res) => {
  const started = performance.now();
  const poolMetrics = getPoolMetrics(pool);

  try {
    const t0 = performance.now();
    const pollResult = await getApplicationStatusForPoll(req.params.id, req.user.id, {
      getApplicationStatusSnapshot,
      getApplicationStatusBundle,
    });
    const bundleQueryMs = Math.round(performance.now() - t0);

    if (!pollResult) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Application not found",
        retryable: false,
      });
    }

    const { row, serialized, fastPath, bundleRow } = pollResult;
    const fingerprint =
      fastPath === "terminal"
        ? buildSnapshotFingerprint(row)
        : buildStatusFingerprint(bundleRow ?? row);
    const etag = computeStatusEtag(fingerprint);
    const ifNoneMatch = parseIfNoneMatch(req.headers["if-none-match"]);

    if (etagMatches(ifNoneMatch, etag)) {
      const durationMs = Math.round(performance.now() - started);
      metrics.increment("orchestration.poll.not_modified");
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "private, no-cache");
      return res.status(304).end();
    }

    const durationMs = Math.round(performance.now() - started);

    if (serialized.pollable) {
      metrics.increment("orchestration.poll.tick", { fastPath: String(fastPath ?? "bundle") });
    }

    logStatusPollEvent(durationMs, bundleQueryMs, {
      applicationId: row.id,
      userId: req.user.id,
      reqId: req.requestId,
      uiStatus: serialized.uiStatus,
      pollable: serialized.pollable,
      terminal: serialized.terminal,
      fastPath,
      ...poolMetrics,
    });

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    return ok(res, {
      applicationId: row.id,
      status: serialized.status,
      uiStatus: serialized.uiStatus,
      terminal: serialized.terminal,
      executionTerminal: serialized.executionTerminal,
      pollable: serialized.pollable,
      canRetry: serialized.canRetry,
      canContinue: serialized.canContinue,
      canSend: serialized.canSend,
      reviewReason: serialized.reviewReason,
      version: Number(row.orchestration_version ?? 0),
      orchestrationEpoch: Number(row.orchestration_epoch ?? 0),
      updatedAt: serialized.updatedAt,
      role: serialized.role ?? null,
      company: serialized.company ?? null,
      matchScore: serialized.matchScore ?? null,
      jdEnrichment: serialized.jdEnrichment,
    });
  } catch (err) {
    logError("STATUS_POLL_ERROR", err, buildLogContext({
      reqId: req.requestId,
      userId: req.user?.id,
      applicationId: req.params?.id,
    }));
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to fetch status",
      retryable: false,
    });
  }
};

const continueApplicationController = async (req, res) => {
  try {
    const { contactEmail } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    const result = await continueApplication(
      req.user.id,
      req.params.id,
      contactEmail,
      req.requestId,
      idempotencyKey
    );
    return ok(res, result);
  } catch (err) {
    return handleCommandError(res, err, req);
  }
};

const retryApplicationController = async (req, res) => {
  try {
    const result = await retryApplication(req.user.id, req.params.id, req.requestId);
    return ok(res, result);
  } catch (err) {
    return handleCommandError(res, err, req);
  }
};

const cancelApplicationController = async (req, res) => {
  try {
    const result = await cancelApplication(req.user.id, req.params.id, req.requestId);
    return ok(res, result);
  } catch (err) {
    return handleCommandError(res, err, req);
  }
};

const patchApplicationEmailController = async (req, res) => {
  try {
    const { emailSubject, emailBody } = req.body || {};
    await patchApplicationEmail(
      req.user.id,
      req.params.id,
      { emailSubject, emailBody },
      req.requestId
    );
    const row = await getApplicationById(req.params.id, req.user.id);
    const detail = serializeApplicationDetail(row);
    return ok(res, detail);
  } catch (err) {
    return handleCommandError(res, err, req);
  }
};

const getApplicationJobController = async (req, res) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Job not found",
        retryable: false,
      });
    }
    const app = await getApplicationById(job.application_id, req.user.id);
    if (!app) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: "Job not found",
        retryable: false,
      });
    }
    return ok(res, job);
  } catch (err) {
    return sendError(res, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Failed to fetch job",
      retryable: false,
    });
  }
};

const listApplicationsLegacyController = listApplicationsController;

module.exports = {
  listApplicationsController,
  getApplicationController,
  getApplicationStatusController,
  continueApplicationController,
  retryApplicationController,
  cancelApplicationController,
  patchApplicationEmailController,
  getApplicationJobController,
  listApplicationsLegacyController,
};
