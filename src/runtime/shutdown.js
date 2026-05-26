const { logInfo, logError } = require("../utils/logger");

const hooks = [];
let shutdownHandlersRegistered = false;
let shuttingDown = false;

/**
 * @param {string} name
 * @param {(signal: string) => void | Promise<void>} fn
 * @param {{ priority?: number }} [options] — higher runs first
 */
function registerShutdownHook(name, fn, options = {}) {
  hooks.push({
    name,
    fn,
    priority: options.priority ?? 0,
  });
}

async function runShutdown(signal) {
  const ordered = [...hooks].sort((a, b) => b.priority - a.priority);
  for (const hook of ordered) {
    try {
      logInfo("SHUTDOWN_HOOK_START", { hook: hook.name, signal });
      await hook.fn(signal);
      logInfo("SHUTDOWN_HOOK_COMPLETE", { hook: hook.name, signal });
    } catch (err) {
      logError("SHUTDOWN_HOOK_FAILED", err, { hook: hook.name, signal });
    }
  }
}

function registerGracefulShutdown() {
  if (shutdownHandlersRegistered) return;
  shutdownHandlersRegistered = true;

  const handle = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo("SHUTDOWN_START", { signal });
    await runShutdown(signal);
    logInfo("SHUTDOWN_COMPLETE", { signal });
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void handle("SIGTERM");
  });
  process.on("SIGINT", () => {
    void handle("SIGINT");
  });
}

module.exports = {
  registerShutdownHook,
  registerGracefulShutdown,
  runShutdown,
};
