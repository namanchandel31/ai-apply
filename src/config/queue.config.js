const { str } = require("./env");
const { isProduction, isTest, isDevelopment } = require("./server.config");

const WORKER_MODE = str("WORKER_MODE", "separate").toLowerCase();

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
    argv1.includes("workers/startWorkers") ||
    argv1.includes("processApplication.worker") ||
    argv1.includes("sendApplication.worker")
  );
}

function isCombinedProcess() {
  const argv1 = process.argv[1] || "";
  return WORKER_MODE === "combined" || argv1.includes("bootstrap.js");
}

/**
 * Legacy dev-only: attach workers via require() inside API process.
 * Prefer `npm run start:all` (bootstrap) for combined API+workers.
 */
function shouldRunInlineWorkers() {
  if (isCombinedProcess()) return false;
  if (WORKER_MODE === "separate") return false;
  if (WORKER_MODE === "inline") {
    if (isProduction) return false;
    if (isWorkerProcess()) return false;
    return isDevelopment || isTest;
  }
  if (isProduction || isTest) return false;
  if (isWorkerProcess()) return false;
  return isDevelopment;
}

function queueValidationStrict() {
  return isProduction;
}

function workerDeploymentMode() {
  if (isCombinedProcess()) return "combined";
  if (shouldRunInlineWorkers()) return "inline";
  return "separate";
}

module.exports = {
  WORKER_MODE,
  WORKER_CONCURRENCY,
  SEND_JOB_MAX_ATTEMPTS,
  PROCESS_JOB_MAX_ATTEMPTS,
  shouldRunInlineWorkers,
  isWorkerProcess,
  isCombinedProcess,
  queueValidationStrict,
  workerDeploymentMode,
};
