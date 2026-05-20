/** @typedef {'realtime'|'reconciliation'|'hydration'|'transport'|'leader'|'poll'} OrchestrationComponent */

const COMPONENT_ENV = {
  realtime: "DEBUG_ORCHESTRATION_REALTIME",
  reconciliation: "DEBUG_ORCHESTRATION_RECONCILIATION",
  hydration: "DEBUG_ORCHESTRATION_HYDRATION",
  transport: "DEBUG_ORCHESTRATION_TRANSPORT",
  leader: "DEBUG_ORCHESTRATION_LEADER",
  poll: "DEBUG_ORCHESTRATION_POLL",
};

const LEGACY_ENV = {
  realtime: "DEBUG_REALTIME",
  reconciliation: "DEBUG_RECONCILIATION",
  hydration: "DEBUG_HYDRATION",
  transport: "DEBUG_TRANSPORT",
  leader: "DEBUG_LEADER",
  poll: "DEBUG_POLL",
};

const legacyWarned = new Set();

function truthy(val) {
  if (val == null) return false;
  const s = String(val).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * @param {OrchestrationComponent} component
 */
function isDebugEnabled(component) {
  if (truthy(process.env[COMPONENT_ENV[component]])) return true;
  const legacy = LEGACY_ENV[component];
  if (truthy(process.env[legacy])) {
    if (!legacyWarned.has(component)) {
      legacyWarned.add(component);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          `[orchestration] ${legacy} is deprecated; use ${COMPONENT_ENV[component]}`
        );
      }
    }
    return true;
  }
  return process.env.LOG_LEVEL === "debug";
}

module.exports = { isDebugEnabled, COMPONENT_ENV };
