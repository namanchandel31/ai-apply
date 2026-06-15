/**
 * Detect which process role owns the shared pg pool (api, worker, migration).
 * Neutral module — avoids db.js ↔ queryInstrumentation cycles.
 */
function detectPoolOwner() {
  const argv1 = process.argv[1] || "";
  if (argv1.includes("workers/") || argv1.includes("workers\\")) return "worker";
  if (argv1.includes("runMigration")) return "migration";
  if (argv1.includes("processApplication.worker") || argv1.includes("sendApplication.worker")) {
    return "worker";
  }
  return "api";
}

module.exports = { detectPoolOwner };
