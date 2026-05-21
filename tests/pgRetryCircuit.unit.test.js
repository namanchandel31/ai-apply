const circuit = require("../src/db/pgRetryCircuit");

describe("pgRetryCircuit", () => {
  beforeEach(() => {
    circuit.resetCircuitForTests();
  });

  it("opens after failure threshold", () => {
    for (let i = 0; i < circuit.FAILURE_THRESHOLD; i++) {
      circuit.recordTransientFailure();
    }
    expect(circuit.isOpen()).toBe(true);
    expect(circuit.canRetry()).toBe(false);
  });

  it("closes after success", () => {
    for (let i = 0; i < circuit.FAILURE_THRESHOLD; i++) {
      circuit.recordTransientFailure();
    }
    circuit.recordSuccess();
    expect(circuit.isOpen()).toBe(false);
    expect(circuit.canRetry()).toBe(true);
  });
});
