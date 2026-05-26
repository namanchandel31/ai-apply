const { PARSE_OUTCOMES, isApplyEligible } = require("../domain/jd/parseOutcomes");
const { normalizeRoleTitle } = require("../domain/jd/roleTaxonomy");
const { skillsForRoles, skillsForRole } = require("../domain/jd/skillOntology");
const { extractRoleCandidates, dedupeCanonicalRoles } = require("./jdRoleExtraction");
const { fallbackExtractTitle } = require("./jdTitleHeuristics");
const { normalizeSkills, nullifyEmpty } = require("../utils/normalise");
const { isValidEmail, isValidPhone } = require("../utils/validators");
const jdParseConfig = require("../config/jdParse.config");

const SPAM_PATTERNS = [
  /\b(crypto|forex|binary\s+options|work\s+from\s+phone)\b/i,
  /\b(earn\s+\$|make\s+\$\d|guaranteed\s+income)\b/i,
  /\b(dm\s+for\s+details|whatsapp\s+only)\b/i,
];

const HIRING_INTENT_PATTERNS = [
  /\b(hiring|open\s+positions?|looking\s+for|join\s+our\s+team|we\s+are\s+hiring)\b/i,
];

const BUZZWORD_PATTERN = /\b(rockstar|ninja|guru|synergy|10x)\b/gi;

function normalizeForMatch(skills) {
  return (skills || [])
    .filter((s) => typeof s === "string")
    .map((s) => s.toLowerCase().trim().replace(/\./g, "").replace(/-/g, " "));
}

function selectBestRole(canonicalRoles, resumeSkills = []) {
  const resumeNorm = normalizeForMatch(resumeSkills);
  if (!canonicalRoles.length) return { role: null, reason: "none", alternates: [] };

  let best = canonicalRoles[0];
  let bestScore = -1;
  let reason = "first_role_fallback";

  for (const role of canonicalRoles) {
    const roleSkills = skillsForRole(role).map((s) => s.toLowerCase());
    let score = 0;
    for (const rs of resumeNorm) {
      for (const js of roleSkills) {
        if (rs.includes(js) || js.includes(rs)) score += 1;
      }
    }
    const roleTokens = role.toLowerCase().split(/\s+/);
    for (const rt of roleTokens) {
      if (resumeNorm.some((rs) => rs.includes(rt) || rt.includes(rs))) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = role;
      if (score > 0) reason = "matched_resume_skills";
    }
  }

  const alternates = canonicalRoles.filter((r) => r !== best);
  if (canonicalRoles.length > 1 && bestScore <= 0) {
    reason = "ambiguous_multi_role";
  }

  return { role: best, reason, alternates };
}

function detectSpam(rawText) {
  return SPAM_PATTERNS.some((re) => re.test(rawText));
}

function hasHiringIntent(rawText, sections) {
  if (HIRING_INTENT_PATTERNS.some((re) => re.test(rawText))) return true;
  return sections.some((s) => s.type === "hiring_roles");
}

function computeParseConfidence({
  llmData,
  canonicalRoles,
  selectedRole,
  titleSource,
  heuristicInSection,
  rawText,
  penalties,
}) {
  const breakdown = {};
  let score = 0;

  if (llmData.job_title) {
    breakdown.explicitLlmTitle = 0.35;
    score += 0.35;
  } else if (selectedRole && titleSource && titleSource !== "explicit_llm") {
    breakdown.fallbackTitle = 0.28;
    score += 0.28;
  }
  if (heuristicInSection) {
    breakdown.hiringSectionRole = 0.2;
    score += 0.2;
  }
  if (titleSource === "alias") {
    breakdown.taxonomyAlias = 0.15;
    score += 0.15;
  }
  const skillCount = (llmData.skills || []).length;
  if (skillCount >= 2) {
    breakdown.skills = 0.15;
    score += 0.15;
  } else if (skillCount === 1) {
    breakdown.skills = 0.08;
    score += 0.08;
  }
  if (selectedRole && titleSource === "matched_resume_skills") {
    breakdown.resumeMatch = 0.1;
    score += 0.1;
  }

  for (const p of penalties) {
    score += p.delta;
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    breakdown,
    penalties,
  };
}

function buildPenalties({ rawText, canonicalRoles, sections }) {
  /** @type {{ id: string, delta: number, reason: string }[]} */
  const penalties = [];

  if (canonicalRoles.length > jdParseConfig.MAX_ROLE_CANDIDATES_PENALTY) {
    penalties.push({ id: "excessive_roles", delta: -0.3, reason: "too_many_role_candidates" });
  } else if (canonicalRoles.length > jdParseConfig.MAX_ROLE_CANDIDATES_WARN) {
    penalties.push({ id: "many_roles", delta: -0.15, reason: "many_role_candidates" });
  }

  if (rawText.length < jdParseConfig.MIN_CONTENT_LENGTH) {
    penalties.push({ id: "ultra_short", delta: -0.2, reason: "content_too_short" });
  }

  const buzzMatches = rawText.match(BUZZWORD_PATTERN);
  if (buzzMatches && buzzMatches.length >= 2) {
    penalties.push({ id: "buzzwords", delta: -0.15, reason: "repeated_buzzwords" });
  }

  if (!hasHiringIntent(rawText, sections)) {
    penalties.push({ id: "no_hiring_intent", delta: -0.25, reason: "zero_hiring_intent" });
  }

  const domains = new Set(
    canonicalRoles.map((r) => {
      const l = r.toLowerCase();
      if (l.includes("engineer") || l.includes("developer")) return "eng";
      if (l.includes("manager")) return "pm";
      if (l.includes("designer")) return "design";
      return "other";
    })
  );
  if (domains.size >= 3) {
    penalties.push({ id: "conflicting_clusters", delta: -0.15, reason: "conflicting_role_clusters" });
  }

  const nonAsciiRatio = (rawText.match(/[^\x00-\x7F]/g) || []).length / Math.max(rawText.length, 1);
  if (nonAsciiRatio > 0.4 && canonicalRoles.length === 0) {
    penalties.push({ id: "malformed", delta: -0.1, reason: "malformed_formatting" });
  }

  return penalties;
}

function assignParseOutcome({ confidence, canonicalRoles, selectionReason, hasRoleOrSkills, rawText }) {
  if (detectSpam(rawText)) return PARSE_OUTCOMES.SPAM_DETECTED;
  if (!hasRoleOrSkills && confidence.score < jdParseConfig.CONFIDENCE_GARBAGE) {
    return PARSE_OUTCOMES.GARBAGE_INPUT;
  }
  if (rawText.length < 20 && !hasRoleOrSkills) return PARSE_OUTCOMES.UNSUPPORTED_FORMAT;
  if (!hasRoleOrSkills) return PARSE_OUTCOMES.GARBAGE_INPUT;

  if (selectionReason === "ambiguous_multi_role" && canonicalRoles.length > 1) {
    return PARSE_OUTCOMES.AMBIGUOUS_MULTI_ROLE;
  }
  if (confidence.score >= jdParseConfig.CONFIDENCE_SUCCESS) {
    return PARSE_OUTCOMES.SUCCESS;
  }
  if (confidence.score >= jdParseConfig.CONFIDENCE_PARTIAL) {
    return PARSE_OUTCOMES.PARTIAL_SUCCESS;
  }
  return PARSE_OUTCOMES.LOW_CONFIDENCE;
}

/**
 * @param {{ rawText: string, llmData: object, resumeSkills?: string[], promptVersion?: string, provider?: object, rawLlmResponse?: unknown, timings?: object }} input
 */
function enrichParsedJd(input) {
  const start = Date.now();
  const { rawText, llmData, resumeSkills = [], promptVersion, provider, rawLlmResponse, timings = {} } =
    input;

  const heuristic = extractRoleCandidates(rawText);
  const llmRoles = (llmData.roles || []).map((r) => normalizeRoleTitle(r));
  const heuristicRoles = heuristic.candidates.map((c) =>
    c.canonical ? { canonical: c.canonical, confidence: c.confidence } : normalizeRoleTitle(c.raw)
  );

  const allCanonical = dedupeCanonicalRoles([
    ...(llmData.job_title ? [normalizeRoleTitle(llmData.job_title).canonical] : []),
    ...llmRoles.map((r) => r.canonical),
    ...heuristicRoles.map((r) => r.canonical),
  ].filter(Boolean));

  const selection = selectBestRole(allCanonical, resumeSkills);
  let job_title = nullifyEmpty(llmData.job_title);
  let titleSource = "explicit_llm";

  if (!job_title && selection.role) {
    job_title = selection.role;
    titleSource = selection.reason === "matched_resume_skills" ? "matched_resume_skills" : "heuristic_roles";
  }

  if (!job_title) {
    const fallback = fallbackExtractTitle(rawText);
    if (fallback?.title) {
      job_title = fallback.title;
      titleSource = fallback.source;
      if (!allCanonical.includes(fallback.title)) {
        allCanonical.unshift(fallback.title);
      }
    }
  }

  if (job_title && !allCanonical.includes(job_title)) {
    allCanonical.unshift(job_title);
  }

  if (job_title) {
    const norm = normalizeRoleTitle(job_title);
    job_title = norm.canonical || job_title;
    if (titleSource === "explicit_llm" && norm.source === "alias") {
      titleSource = "alias";
    }
  }

  let skills = normalizeSkills(llmData.skills || []);
  if (!skills.length && selection.role) {
    skills = normalizeSkills(skillsForRoles([selection.role]));
    titleSource = skills.length ? "inferred_from_skills" : titleSource;
  }
  if (!skills.length && allCanonical.length) {
    skills = normalizeSkills(skillsForRoles(allCanonical));
  }

  const data = {
    job_title,
    roles: allCanonical,
    company_name: nullifyEmpty(llmData.company_name),
    contact_person: nullifyEmpty(llmData.contact_person),
    location: nullifyEmpty(llmData.location),
    contact_email: llmData.contact_email,
    contact_number: llmData.contact_number,
    job_type: llmData.job_type ?? null,
    skills,
  };

  if (data.contact_email && !isValidEmail(data.contact_email)) data.contact_email = null;
  if (data.contact_number && !isValidPhone(data.contact_number)) data.contact_number = null;

  const heuristicInSection = heuristic.candidates.some((c) => c.sectionIndex >= 0);
  const penalties = buildPenalties({
    rawText,
    canonicalRoles: allCanonical,
    sections: heuristic.sections,
  });

  const confidence = computeParseConfidence({
    llmData,
    canonicalRoles: allCanonical,
    selectedRole: job_title,
    titleSource,
    heuristicInSection,
    rawText,
    penalties,
  });

  const hasRoleOrSkills = Boolean(job_title || skills.length);
  let parseOutcome = assignParseOutcome({
    confidence,
    canonicalRoles: allCanonical,
    selectionReason: selection.reason,
    hasRoleOrSkills,
    rawText,
  });

  if (parseOutcome === PARSE_OUTCOMES.SUCCESS && !data.company_name && !data.contact_email) {
    parseOutcome = PARSE_OUTCOMES.PARTIAL_SUCCESS;
  }

  const needsReview =
    parseOutcome === PARSE_OUTCOMES.LOW_CONFIDENCE ||
    parseOutcome === PARSE_OUTCOMES.AMBIGUOUS_MULTI_ROLE;

  const reviewHints = {
    needsReview,
    reviewReason: needsReview ? parseOutcome : null,
    candidateRoles: allCanonical,
  };

  const parseArtifacts = {
    promptVersion,
    provider,
    rawLlmResponse: rawLlmResponse ?? llmData,
    heuristicExtraction: {
      sections: heuristic.sections,
      roleCandidates: heuristic.candidates,
      excludedBullets: heuristic.excludedBullets,
    },
    enrichedOutput: { ...data },
    selection: {
      selectedRole: job_title,
      selectionReason: selection.reason,
      titleSource,
      roleCandidates: allCanonical,
      alternateRoles: selection.alternates,
    },
    confidence,
    timings: { ...timings, enrichMs: Date.now() - start },
    createdAt: new Date().toISOString(),
  };

  return {
    data: {
      ...data,
      parseOutcome,
      parseConfidence: confidence.score,
      parseArtifacts,
      reviewHints,
    },
    parseOutcome,
    parseConfidence: confidence.score,
    parseArtifacts,
    reviewHints,
    isApplyEligible: isApplyEligible(parseOutcome) && hasRoleOrSkills,
  };
}

module.exports = {
  enrichParsedJd,
  selectBestRole,
  computeParseConfidence,
  detectSpam,
};
