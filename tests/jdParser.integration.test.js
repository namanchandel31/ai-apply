require("dotenv").config();
const { performance } = require("perf_hooks");
const { parseJobDescription } = require("../src/services/jdParserService");

const testCases = [
  {
    name: "Clean structured job description",
    text: `Job Title: Senior Backend Engineer
Company: Tech Solutions Inc.
Location: San Francisco, CA (Hybrid)
Contact Person: Alice Smith
Email: alice.smith@techsolutions.com
Phone: +1-555-019-8273
Requirements: We are looking for a Node.js expert with experience in PostgreSQL and AWS.`
  },
  {
    name: "Messy WhatsApp-style job description",
    text: `Urgent requirement bro!! need a frontend dev for my startup. ping me if u know react native and tailwind. remote work. salary 50k. email: boss@startup.in`
  },
  {
    name: "Job description with no contact info",
    text: `We are hiring a Data Scientist to join our team in London. The ideal candidate will have 3+ years working with Python, Pandas, and Machine Learning models. This is a fully onsite role.`
  },
  {
    name: "Garbage / irrelevant text",
    text: `Hey, did you buy the milk from the grocery store? I think we also need some eggs and bread. Let me know when you're back.`
  }
];

async function runTests() {
  let successCount = 0;
  let failureCount = 0;
  let successfulTotalTime = 0;
  let minTime = Infinity;
  let maxTime = 0;
  const errorMap = {};
  
  const globalStart = performance.now();

  for (const tc of testCases) {
    console.log("\n==============================");
    console.log(`TEST: ${tc.name}`);
    console.log("==============================");
    
    const snippet = tc.text.length > 80 ? tc.text.substring(0, 80) + "..." : tc.text;
    console.log(`Input: "${snippet}"`);

    const startTime = performance.now();
    try {
      const result = await parseJobDescription(tc.text);
      console.log("Result:");
      console.dir(result, { depth: null });
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      minTime = Math.min(minTime, duration);
      maxTime = Math.max(maxTime, duration);
      
      successfulTotalTime += duration;
      successCount++;
      console.log(`Time: ${(duration / 1000).toFixed(2)}s\n`);
    } catch (err) {
      console.error("Error:", err.message);
      errorMap[err.message] = (errorMap[err.message] || 0) + 1;
      failureCount++;
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`Time: ${(duration / 1000).toFixed(2)}s\n`);
    }
  }

  const globalEnd = performance.now();

  if (successCount === 0) {
    minTime = 0;
    maxTime = 0;
  }

  const avgTime = successCount > 0 ? (successfulTotalTime / successCount / 1000).toFixed(2) : "0.00";
  const totalSeconds = (globalEnd - globalStart) / 1000;
  const throughput = totalSeconds > 0 ? (testCases.length / totalSeconds).toFixed(2) : "0.00";

  console.log({
    total: testCases.length,
    success: successCount,
    failed: failureCount,
    avgTime: `${avgTime}s`,
    minTime: `${(minTime / 1000).toFixed(2)}s`,
    maxTime: `${(maxTime / 1000).toFixed(2)}s`,
    totalTime: `${totalSeconds.toFixed(2)}s`,
    throughput: `${throughput} req/sec`,
    errors: errorMap
  });
}

runTests();
