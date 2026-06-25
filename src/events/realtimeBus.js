const { EventEmitter } = require("events");

/**
 * In-process domain event bus. Workers emit here; SSE gateway subscribes.
 * Future: replace fan-out with Redis pub/sub without changing emit sites.
 */
class RealtimeBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.on("error", (err) => {
      const { logNetworkError } = require("../observability/networkError");
      logNetworkError("realtime_bus", err, { phase: "emitter_error" });
    });
  }
}

const realtimeBus = new RealtimeBus();

/** @typedef {import('./realtimeTypes')} RealtimeTypes */

module.exports = { realtimeBus, RealtimeBus };
