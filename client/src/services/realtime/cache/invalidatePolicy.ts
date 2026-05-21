const MAX_STALE_WINDOW_MS = 90_000;

type InvalidatePolicy =
  | "terminal"
  | "reconnect"
  | "reject_storm"
  | "invalidate_storm"
  | "stale_watchdog"
  | "burst_partial";

type PolicyConfig = {
  debounceMs: number;
  capPerWindow: number;
  windowMs: number;
  suppressBulk?: boolean;
};

const POLICIES: Record<InvalidatePolicy, PolicyConfig> = {
  terminal: { debounceMs: 0, capPerWindow: 999, windowMs: 30_000 },
  reconnect: { debounceMs: 500, capPerWindow: 2, windowMs: 30_000 },
  reject_storm: { debounceMs: 5_000, capPerWindow: 2, windowMs: 30_000 },
  invalidate_storm: { debounceMs: 0, capPerWindow: 1, windowMs: 30_000, suppressBulk: true },
  stale_watchdog: { debounceMs: 0, capPerWindow: 1, windowMs: MAX_STALE_WINDOW_MS },
  burst_partial: { debounceMs: 1_000, capPerWindow: 1, windowMs: 10_000 },
};

const counts = new Map<string, { count: number; windowStart: number }>();
let suppressUntil = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPolicy: InvalidatePolicy | null = null;
let pendingRun: (() => void) | null = null;

export function isInvalidateSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

export function recordInvalidateStorm() {
  suppressUntil = Date.now() + 30_000;
}

export function scheduleListInvalidation(
  policy: InvalidatePolicy,
  run: () => void
): boolean {
  const cfg = POLICIES[policy];
  const now = Date.now();

  if (cfg.suppressBulk && isInvalidateSuppressed() && policy !== "stale_watchdog") {
    return false;
  }

  const key = policy;
  const bucket = counts.get(key) ?? { count: 0, windowStart: now };
  if (now - bucket.windowStart > cfg.windowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  if (bucket.count >= cfg.capPerWindow) {
    if (policy === "invalidate_storm") recordInvalidateStorm();
    return false;
  }
  bucket.count += 1;
  counts.set(key, bucket);

  pendingPolicy = policy;
  pendingRun = run;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const fn = pendingRun;
    pendingRun = null;
    pendingPolicy = null;
    fn?.();
  }, cfg.debounceMs);
  return true;
}

export function resetInvalidatePolicyForTests() {
  counts.clear();
  suppressUntil = 0;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  pendingPolicy = null;
  pendingRun = null;
}
