import { CATASTROPHIC_COOLDOWN_MS, CATASTROPHIC_MAX_ATTEMPTS } from "./reconnectRecoveryConfig";
import { logDebug } from "@/services/logging/orchestrationLogger";
import { metrics } from "@/services/logging/metricsHooks";

type GuardState = {
  attempts: number;
  windowStart: number;
  exhaustedUntil: number;
};

let state: GuardState = {
  attempts: 0,
  windowStart: 0,
  exhaustedUntil: 0,
};

const WINDOW_MS = CATASTROPHIC_COOLDOWN_MS;

export function isRealtimeDegraded(): boolean {
  return Date.now() < state.exhaustedUntil;
}

export function canRunCatastrophicRecovery(): boolean {
  if (isRealtimeDegraded()) return false;
  const now = Date.now();
  if (now - state.windowStart > WINDOW_MS) {
    state.attempts = 0;
    state.windowStart = now;
  }
  return state.attempts < CATASTROPHIC_MAX_ATTEMPTS;
}

export function recordCatastrophicRecoveryAttempt(): void {
  const now = Date.now();
  if (now - state.windowStart > WINDOW_MS) {
    state.attempts = 0;
    state.windowStart = now;
  }
  state.attempts += 1;
  metrics.increment("orchestration.recovery.tier3_count");

  if (state.attempts >= CATASTROPHIC_MAX_ATTEMPTS) {
    state.exhaustedUntil = now + CATASTROPHIC_COOLDOWN_MS;
    metrics.increment("orchestration.realtime.degraded_mode_count");
    logDebug(
      "REALTIME_DEGRADED_MODE",
      { attempts: state.attempts, exhaustedUntil: state.exhaustedUntil },
      "reconciliation"
    );
    logDebug(
      "CATASTROPHIC_RECOVERY_COOLDOWN",
      { attempts: state.attempts, cooldownMs: CATASTROPHIC_COOLDOWN_MS },
      "reconciliation"
    );
  }
}

export function resetCatastrophicRecoveryForManual(): void {
  state = { attempts: 0, windowStart: 0, exhaustedUntil: 0 };
  metrics.increment("orchestration.realtime.manual_recovery_count");
}

export function resetCatastrophicRecoveryForTests(): void {
  state = { attempts: 0, windowStart: 0, exhaustedUntil: 0 };
}
