/**
 * Derive target word range from structure mode + seniority band.
 */

const RANGE_TABLE = {
  conversational: {
    intern_junior: [80, 120],
    mid: [100, 140],
    senior_lead: [120, 160],
  },
  balanced: {
    intern_junior: [100, 140],
    mid: [120, 180],
    senior_lead: [140, 200],
  },
  structured: {
    intern_junior: [120, 180],
    mid: [140, 200],
    senior_lead: [160, 220],
  },
  highly_scannable: {
    intern_junior: [140, 200],
    mid: [160, 220],
    senior_lead: [180, 250],
  },
};

const SENIOR_TITLE_PATTERNS = [
  /\bsenior\b/i,
  /\blead\b/i,
  /\bprincipal\b/i,
  /\bstaff\b/i,
  /\bmanager\b/i,
  /\bdirector\b/i,
  /\bhead of\b/i,
  /\bvp\b/i,
  /\bchief\b/i,
];

const JUNIOR_TITLE_PATTERNS = [
  /\bintern\b/i,
  /\bjunior\b/i,
  /\bentry[\s-]?level\b/i,
  /\bgraduate\b/i,
];

function inferSeniorityBand({ jobTitle, resumeParsedJson }) {
  const title = String(jobTitle || "");
  if (SENIOR_TITLE_PATTERNS.some((p) => p.test(title))) return "senior_lead";
  if (JUNIOR_TITLE_PATTERNS.some((p) => p.test(title))) return "intern_junior";

  const experience = resumeParsedJson?.experience || [];
  if (experience.length >= 3) return "senior_lead";
  if (experience.length <= 1) return "intern_junior";
  return "mid";
}

function deriveTargetWordRange(structureMode, seniorityBand) {
  const band = RANGE_TABLE[structureMode] || RANGE_TABLE.balanced;
  const [min, max] = band[seniorityBand] || band.mid;
  return { min, max };
}

/** UI-only: derive short/medium/long label from target range midpoint. */
function deriveLengthLabel(targetWordRange) {
  const mid = (targetWordRange.min + targetWordRange.max) / 2;
  if (mid < 130) return "short";
  if (mid < 175) return "medium";
  return "long";
}

module.exports = {
  inferSeniorityBand,
  deriveTargetWordRange,
  deriveLengthLabel,
};
