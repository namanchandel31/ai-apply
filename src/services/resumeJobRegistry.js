const { logInfo, logError } = require("../utils/logger");
const { JOB_REGISTRY_TTL_MS } = require("../config/parsingConfig");

/** @type {Map<string, object>} */
const jobs = new Map();

const pruneExpiredJobs = () => {
  const cutoff = Date.now() - JOB_REGISTRY_TTL_MS;
  for (const [id, entry] of jobs) {
    if (entry.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
};

setInterval(pruneExpiredJobs, 10 * 60 * 1000).unref();

/**
 * Run resume parsing detached from the HTTP request lifecycle.
 * @param {string} jobId
 * @param {string} userId
 * @param {() => Promise<object>} runJob - returns processResumeJob result
 */
const enqueueResumeJob = (jobId, userId, runJob) => {
  pruneExpiredJobs();

  const entry = {
    jobId,
    userId,
    status: "processing",
    createdAt: Date.now(),
    completedAt: null,
    result: null,
    error: null,
  };

  jobs.set(jobId, entry);

  logInfo("resume_job_enqueued", { jobId, userId, status: "processing" });

  runJob()
    .then((result) => {
      entry.status = "completed";
      entry.result = result;
      entry.completedAt = Date.now();
      logInfo("resume_job_completed", {
        jobId,
        userId,
        status: "completed",
        latencyMs: entry.completedAt - entry.createdAt,
      });
    })
    .catch((err) => {
      entry.status = "failed";
      entry.error = {
        message: err.message,
        name: err.name,
      };
      entry.completedAt = Date.now();
      logError("resume_job_failed", err, {
        jobId,
        userId,
        status: "failed",
        latencyMs: entry.completedAt - entry.createdAt,
      });
    });

  return entry;
};

/**
 * @param {string} jobId
 * @param {string} userId
 */
const getResumeJob = (jobId, userId) => {
  const entry = jobs.get(jobId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  return entry;
};

module.exports = {
  enqueueResumeJob,
  getResumeJob,
  /** @internal test helper */
  _clearJobs: () => jobs.clear(),
};
