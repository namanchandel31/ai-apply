const { str } = require("./env");
const { isProduction, isTest, isDevelopment } = require("./server.config");

/** Code-only — do not expose via env. Scale via worker replicas. */
const WORKER_CONCURRENCY = {
  process: 2,
  send: 3,
};

const SEND_JOB_MAX_ATTEMPTS = 5;
const PROCESS_JOB_MAX_ATTEMPTS = 3;

function isWorkerProcess() {
  const argv1 = process.argv[1] || "";
  return (
    argv1.includes("workers/index") ||
    argv1.includes("processApplication.worker") ||
    argv1.includes("sendApplication.worker")
  );
}

function shouldRunInlineWorkers() {
  if (isProduction || isTest) return false;
  if (isWorkerProcess()) return false;
  return isDevelopment;
}

function queueValidationStrict() {
  return isProduction;
}

function workerDeploymentMode() {
  return shouldRunInlineWorkers() ? "inline" : "separate";
}

module.exports = {
  WORKER_CONCURRENCY,
  SEND_JOB_MAX_ATTEMPTS,
  PROCESS_JOB_MAX_ATTEMPTS,
  shouldRunInlineWorkers,
  isWorkerProcess,
  queueValidationStrict,
  workerDeploymentMode,
};
