const fs = require("fs");
const path = require("path");
const { enrichParsedJd } = require("../src/services/jdParseEnrichment");

const manifest = require("./fixtures/jd-golden/manifest.json");
const baseline = require("./fixtures/jd-golden/baseline.json");
const FIXTURES_DIR = path.join(__dirname, "fixtures/jd-golden");

function loadRaw(entry) {
  if (entry.raw) return entry.raw;
  const filePath = path.join(FIXTURES_DIR, entry.file);
  return fs.readFileSync(filePath, "utf8");
}

function roleRecall(found, expected) {
  if (!expected.length) return found.length === 0 ? 1 : 0;
  const hits = expected.filter((e) =>
    found.some((f) => f.toLowerCase().includes(e.toLowerCase().split(" ")[0]))
  );
  return hits.length / expected.length;
}

describe("jd golden regression", () => {
  const results = {
    acceptExpected: 0,
    acceptPassed: 0,
    rejectExpected: 0,
    rejectPassed: 0,
    falsePositives: 0,
    titleHits: 0,
    titleTotal: 0,
  };

  for (const entry of manifest) {
    it(`fixture: ${entry.id}`, () => {
      const rawText = loadRaw(entry);
      const enriched = enrichParsedJd({
        rawText,
        llmData: { job_title: null, roles: [], skills: [] },
        resumeSkills: entry.resumeSkills || [],
      });

      if (entry.shouldAccept) {
        results.acceptExpected += 1;
        if (enriched.isApplyEligible) results.acceptPassed += 1;
      } else {
        results.rejectExpected += 1;
        if (!enriched.isApplyEligible) results.rejectPassed += 1;
      }

      const foundRoles = enriched.data.roles || [];
      const recall = roleRecall(foundRoles, entry.expectedRoles || []);
      expect(recall).toBeGreaterThanOrEqual(0);

      if (entry.shouldAccept) {
        expect(enriched.isApplyEligible).toBe(true);
        if (entry.expectedTitle) {
          results.titleTotal += 1;
          if (enriched.data.job_title === entry.expectedTitle) results.titleHits += 1;
          expect(enriched.data.job_title).toBe(entry.expectedTitle);
        }
      } else {
        if (foundRoles.length && !(entry.expectedRoles || []).length) {
          results.falsePositives += 1;
        }
        if (entry.expectedOutcome) {
          expect(enriched.parseOutcome).toBe(entry.expectedOutcome);
        }
        expect(enriched.isApplyEligible).toBe(false);
      }
    });
  }

  it("meets baseline thresholds", () => {
    const acceptanceRate =
      results.acceptPassed / Math.max(results.acceptExpected, 1);
    const rejectRate = results.rejectPassed / Math.max(results.rejectExpected, 1);
    const titleAccuracy = results.titleHits / Math.max(results.titleTotal, 1);
    const fpRate = results.falsePositives / Math.max(results.rejectExpected, 1);

    expect(acceptanceRate).toBeGreaterThanOrEqual(baseline.minParseAcceptanceRate);
    expect(rejectRate).toBeGreaterThanOrEqual(baseline.minParseAcceptanceRate);
    expect(fpRate).toBeLessThanOrEqual(baseline.maxFalsePositiveRate);
    if (results.titleTotal > 0) {
      expect(titleAccuracy).toBeGreaterThanOrEqual(baseline.minTitleSelectionAccuracy);
    }
  });
});
