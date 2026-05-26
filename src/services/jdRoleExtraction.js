const { parseHiringSections } = require("./jdHiringSectionParser");
const { normalizeRoleTitle } = require("../domain/jd/roleTaxonomy");

/**
 * @param {string} rawText
 * @returns {{ raw: string, canonical: string|null, confidence: number, sectionIndex: number }[]}
 */
function extractRoleCandidates(rawText) {
  const { roleCandidates, sections, excludedBullets } = parseHiringSections(rawText);
  const seen = new Set();
  const results = [];

  for (const { raw, sectionIndex } of roleCandidates) {
    const norm = normalizeRoleTitle(raw);
    const key = norm.canonical || raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      raw,
      canonical: norm.canonical,
      confidence: norm.confidence,
      sectionIndex,
      matchedAlias: norm.matchedAlias,
    });
  }

  return {
    candidates: results,
    sections,
    excludedBullets,
  };
}

function dedupeCanonicalRoles(roles) {
  const seen = new Set();
  const out = [];
  for (const r of roles) {
    const key = (r || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

module.exports = {
  extractRoleCandidates,
  dedupeCanonicalRoles,
};
