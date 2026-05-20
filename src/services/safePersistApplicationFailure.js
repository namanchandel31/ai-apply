const { transitionJobState } = require("./transitionJobState");
const { transitionApplicationState } = require("./transitionApplicationState");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");
const { logError } = require("../utils/logger");
const { buildLogContext } = require("../utils/buildLogContext");

/**
 * Persist terminal failure without throwing — nested try/catch prevents secondary crashes.
 */
async function safePersistApplicationFailure(
  client,
  {
    applicationId,
    userId = null,
    jobId = null,
    failureStage = "unknown",
    lastError = "processing_error",
    expectedAppStatuses = [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.GENERATED],
  }
) {
  const ctx = buildLogContext({ applicationId, jobId, userId });

  if (jobId) {
    try {
      await transitionJobState(client, {
        jobId,
        expectedStatus: ["processing", "queued", "retrying"],
        nextStatus: "failed",
        lastError,
      });
    } catch (persistErr) {
      logError("FAILURE_PERSIST_ERROR", persistErr, {
        ...ctx,
        stage: "job_transition",
      });
    }
  }

  try {
    await transitionApplicationState(client, {
      applicationId,
      userId,
      expectedStatus: expectedAppStatuses,
      nextStatus: APPLICATION_STATUS.FAILED,
      clearReviewReason: true,
      patch: { lastError, failureStage },
    });
  } catch (persistErr) {
    logError("FAILURE_PERSIST_ERROR", persistErr, {
      ...ctx,
      stage: "application_transition",
    });
  }
}

module.exports = { safePersistApplicationFailure };
