const fs = require("fs");
const path = require("path");
const { logInfo, logError } = require("../utils/logger");
const config = require("../config");

const RUNTIME_DIR = path.join(process.cwd(), ".runtime");
const API_PID_FILE = path.join(RUNTIME_DIR, "api.pid");

let registered = false;

function readPidFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

function registerRuntimeOwnership({ role, sseGatewayOwner = false } = {}) {
  if (registered) return;
  registered = true;

  const payload = {
    event: "RUNTIME_PROCESS_STARTED",
    pid: process.pid,
    role,
    sseGatewayOwner: Boolean(sseGatewayOwner),
    workerMode: config.queue.workerDeploymentMode(),
    nodeEnv: config.server.nodeEnv,
  };

  try {
    const { POOL_INSTANCE_ID } = require("../db");
    payload.poolInstanceId = POOL_INSTANCE_ID;
  } catch (_) {
    /* ignore */
  }

  logInfo("RUNTIME_PROCESS_STARTED", payload);

  if (role === "api" && sseGatewayOwner) {
    const strict = config.runtime.strictSingleApi;

    if (!fs.existsSync(RUNTIME_DIR)) {
      fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    }

    const existingPid = readPidFile(API_PID_FILE);
    if (existingPid && existingPid !== process.pid && isProcessAlive(existingPid)) {
      const msg = `Another API process may already own SSE (pid=${existingPid}); current pid=${process.pid}`;
      logError("RUNTIME_DUPLICATE_API_WARNING", new Error(msg), {
        existingPid,
        currentPid: process.pid,
      });
      if (strict) {
        throw new Error(msg);
      }
    }

    try {
      fs.writeFileSync(API_PID_FILE, String(process.pid), "utf8");
    } catch (err) {
      logError("RUNTIME_PID_FILE_WRITE_FAILED", err);
    }

    const { startPostCommitSweep } = require("../realtime/postCommitPublishQueue");
    startPostCommitSweep();
  }
}

module.exports = {
  registerRuntimeOwnership,
  RUNTIME_DIR,
  API_PID_FILE,
};
