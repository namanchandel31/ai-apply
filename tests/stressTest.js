require("dotenv").config();
const { performance } = require("perf_hooks");
const { parseJobDescription } = require("../src/services/jdParserService");

const TOTAL_RUNS = 2;
const CONCURRENCY_LIMIT = 1;
const INPUT_STRING = "urgent hiring flutter dev exp 1-2 yrs call 9876543210 location jaipur";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function runWorker(results) {
  const start = performance.now();
  let success = true;
  let error;

  try {
    await parseJobDescription(INPUT_STRING);
  } catch (err) {
    success = false;
    error = err.message;
  }

  const end = performance.now();
  results.push({
    success,
    time: end - start,
    ...(error && { error })
  });
}

async function runStressTest() {
  const results = [];
  const globalStart = performance.now();

  for (let i = 0; i < TOTAL_RUNS; i += CONCURRENCY_LIMIT) {
    const batch = [];
    const limit = Math.min(CONCURRENCY_LIMIT, TOTAL_RUNS - i);
    for (let j = 0; j < limit; j++) {
      batch.push(runWorker(results));
    }
    await Promise.all(batch);
    console.log(`Completed ${Math.min(i + CONCURRENCY_LIMIT, TOTAL_RUNS)} / ${TOTAL_RUNS}`);
    if (i + CONCURRENCY_LIMIT < TOTAL_RUNS) {
      await sleep(300);
    }
  }

  const globalEnd = performance.now();
  const successfulRuns = results.filter(r => r.success);
  const failedRuns = results.filter(r => !r.success);

  let totalReqTime = 0;
  let minTime = Infinity;
  let maxTime = 0;

  for (const r of successfulRuns) {
    totalReqTime += r.time;
    if (r.time < minTime) minTime = r.time;
    if (r.time > maxTime) maxTime = r.time;
  }

  if (successfulRuns.length === 0) {
    minTime = 0;
    maxTime = 0;
  }

  const avgTime = successfulRuns.length > 0 ? (totalReqTime / successfulRuns.length) : 0;
  const totalSeconds = (globalEnd - globalStart) / 1000;
  const throughput = totalSeconds > 0 ? (TOTAL_RUNS / totalSeconds) : 0;
  const successRate = TOTAL_RUNS > 0 ? (successfulRuns.length / TOTAL_RUNS) * 100 : 0;

  const errorMap = {};
  const sampleErrors = [];
  for (const r of failedRuns) {
    if (r.error) {
      errorMap[r.error] = (errorMap[r.error] || 0) + 1;
      if (sampleErrors.length < 3) {
        sampleErrors.push(r.error);
      }
    }
  }

  console.dir({
    total: TOTAL_RUNS,
    success: successfulRuns.length,
    failed: failedRuns.length,
    successRate: `${successRate.toFixed(2)}%`,
    avgTime: `${Math.round(avgTime)} ms`,
    minTime: `${Math.round(minTime)} ms`,
    maxTime: `${Math.round(maxTime)} ms`,
    totalTime: `${totalSeconds.toFixed(2)} s`,
    throughput: `${throughput.toFixed(2)} req/sec`,
    errors: errorMap,
    sampleErrors: sampleErrors
  }, { depth: null });
}

runStressTest();
