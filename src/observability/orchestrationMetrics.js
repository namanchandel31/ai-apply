/** @type {Map<string, number>} */
const counters = new Map();
/** @type {Map<string, { count: number, sum: number, max: number }>} */
const histograms = new Map();
/** @type {Map<string, number>} */
const gauges = new Map();

function metricKey(name, tags = {}) {
  const parts = Object.keys(tags)
    .sort()
    .map((k) => `${k}=${tags[k]}`);
  return parts.length ? `${name}|${parts.join(",")}` : name;
}

function increment(name, tags = {}, value = 1) {
  const k = metricKey(name, tags);
  counters.set(k, (counters.get(k) || 0) + value);
}

function histogram(name, value, tags = {}) {
  const k = metricKey(name, tags);
  const h = histograms.get(k) || { count: 0, sum: 0, max: 0 };
  h.count += 1;
  h.sum += value;
  h.max = Math.max(h.max, value);
  histograms.set(k, h);
}

function gauge(name, value, tags = {}) {
  gauges.set(metricKey(name, tags), value);
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

const metrics = { increment, histogram, gauge, getSnapshot, reset };

module.exports = { metrics };
