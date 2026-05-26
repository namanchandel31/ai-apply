const { normalizeRoleTitle } = require("../domain/jd/roleTaxonomy");
const { extractRoleCandidates } = require("./jdRoleExtraction");
const { classifyNonRoleBullet } = require("./jdHiringSectionParser");

const TITLE_LINE_PATTERNS = [
  /^(?:job\s+title|position|role|designation)\s*[:\-–]\s*(.+)$/i,
  /^(?:hiring|looking\s+for)\s*[:\-–]?\s*(.+)$/i,
  /^#\s*(.+)$/,
];

const ROLE_LIKE = /\b(developer|engineer|designer|manager|architect|analyst|intern|lead)\b/i;

function isPlausibleTitleLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 100) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/@[\w.-]+\.\w+/.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (classifyNonRoleBullet(trimmed)) return false;
  if (/^(requirements?|qualifications?|about|description)\b/i.test(trimmed)) return false;
  return ROLE_LIKE.test(trimmed) || (/^[A-Z]/.test(trimmed) && trimmed.split(/\s+/).length <= 8);
}

/**
 * Extract title from labeled patterns in raw text.
 */
function inferTitleFromPatterns(rawText) {
  const lines = String(rawText || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    for (const re of TITLE_LINE_PATTERNS) {
      const m = trimmed.match(re);
      if (m?.[1] && isPlausibleTitleLine(m[1])) {
        const norm = normalizeRoleTitle(m[1].trim());
        if (norm.canonical) return { title: norm.canonical, source: "pattern_labeled" };
      }
    }
  }
  return null;
}

/**
 * First plausible non-header line as title candidate.
 */
function heuristicExtractTitle(rawText) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 8)) {
    if (!isPlausibleTitleLine(line)) continue;
    const norm = normalizeRoleTitle(line);
    if (norm.canonical) {
      return { title: norm.canonical, source: "first_line_heuristic" };
    }
  }
  return null;
}

/**
 * Combined fallback: section roles → patterns → first line.
 */
function fallbackExtractTitle(rawText) {
  const { candidates } = extractRoleCandidates(rawText);
  if (candidates.length) {
    const first = candidates.find((c) => c.canonical) || candidates[0];
    const norm = first.canonical ? { canonical: first.canonical } : normalizeRoleTitle(first.raw);
    if (norm.canonical) {
      return { title: norm.canonical, source: "heuristic_section_roles" };
    }
  }

  const fromPattern = inferTitleFromPatterns(rawText);
  if (fromPattern) return fromPattern;

  return heuristicExtractTitle(rawText);
}

module.exports = {
  heuristicExtractTitle,
  inferTitleFromPatterns,
  fallbackExtractTitle,
  isPlausibleTitleLine,
};
