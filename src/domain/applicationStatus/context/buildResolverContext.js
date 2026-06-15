const { APPLICATION_STATUS, JOB_STATUS, ACTIVE_JOB_STATUSES } = require("../constants/uiStatuses");

/**
 * Maps persistence layer rows into normalized resolver context.
 * Only this module should read raw DB field names.
 */
function buildResolverContext({
  applicationStatus,
  reviewReason = null,
  latestProcessJob = null,
  latestSendJob = null,
  retryCount = 0,
  emailSubject = null,
  emailBody = null,
}) {
  const latestProcessJobStatus = latestProcessJob?.status ?? null;
  const latestSendJobStatus = latestSendJob?.status ?? null;

  const hasActiveProcessJob =
    latestProcessJobStatus && ACTIVE_JOB_STATUSES.has(latestProcessJobStatus);
  const hasActiveSendJob =
    latestSendJobStatus && ACTIVE_JOB_STATUSES.has(latestSendJobStatus);
  const hasCompletedSendJob = latestSendJobStatus === JOB_STATUS.COMPLETED;

  return {
    applicationStatus,
    reviewReason,
    latestProcessJobStatus,
    latestSendJobStatus,
    hasActiveProcessJob: Boolean(hasActiveProcessJob),
    hasActiveSendJob: Boolean(hasActiveSendJob),
    hasCompletedSendJob,
    retryCount,
    isSent: applicationStatus === APPLICATION_STATUS.SENT,
    isCancelled: applicationStatus === APPLICATION_STATUS.CANCELLED,
    isFailed: applicationStatus === APPLICATION_STATUS.FAILED,
    isDraft: applicationStatus === APPLICATION_STATUS.DRAFT,
    isGenerated: applicationStatus === APPLICATION_STATUS.GENERATED,
    isNeedsReview: applicationStatus === APPLICATION_STATUS.NEEDS_REVIEW,
    emailSubject,
    emailBody,
  };
}

module.exports = { buildResolverContext };
