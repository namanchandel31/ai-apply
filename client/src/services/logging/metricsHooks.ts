type Tags = Record<string, string | number | boolean | undefined>;

const counters = new Map<string, number>();
const histograms = new Map<string, { count: number; sum: number; max: number }>();
const gauges = new Map<string, number>();

function metricKey(name: string, tags: Tags = {}) {
  const parts = Object.keys(tags)
    .sort()
    .map((k) => `${k}=${tags[k]}`);
  return parts.length ? `${name}|${parts.join(",")}` : name;
}

function increment(name: string, tags: Tags = {}, value = 1) {
  const k = metricKey(name, tags);
  counters.set(k, (counters.get(k) || 0) + value);
  const hook = (globalThis as { __orchestrationMetrics?: typeof metrics }).__orchestrationMetrics;
  hook?.increment(name, tags, value);
}

function histogram(name: string, value: number, tags: Tags = {}) {
  const k = metricKey(name, tags);
  const h = histograms.get(k) || { count: 0, sum: 0, max: 0 };
  h.count += 1;
  h.sum += value;
  h.max = Math.max(h.max, value);
  histograms.set(k, h);
  const hook = (globalThis as { __orchestrationMetrics?: typeof metrics }).__orchestrationMetrics;
  hook?.histogram(name, value, tags);
}

function gauge(name: string, value: number, tags: Tags = {}) {
  gauges.set(metricKey(name, tags), value);
  const hook = (globalThis as { __orchestrationMetrics?: typeof metrics }).__orchestrationMetrics;
  hook?.gauge(name, value, tags);
}

function getSnapshot() {
  return {
    counters: Object.fromEntries(counters),
    histograms: Object.fromEntries(histograms),
    gauges: Object.fromEntries(gauges),
  };
}

function reset() {
  counters.clear();
  histograms.clear();
  gauges.clear();
}

export const metrics = { increment, histogram, gauge, getSnapshot, reset };
