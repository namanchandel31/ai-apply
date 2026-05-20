/**
 * Build correlated lifecycle log context (omit null/undefined fields).
 */
function buildLogContext({
  applicationId,
  jobId,
  userId,
  reqId,
  workerName,
  queueName,
  jobType,
  attempt,
  provider,
  route,
  method,
}) {
  return Object.fromEntries(
    Object.entries({
      applicationId,
      jobId,
      userId,
      reqId,
      workerName,
      queueName,
      jobType,
      attempt,
      provider,
      route,
      method,
    }).filter(([, value]) => value != null)
  );
}

module.exports = { buildLogContext };
