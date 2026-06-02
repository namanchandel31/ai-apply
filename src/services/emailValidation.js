const {
  wordCount,
  splitParagraphs,
  splitSentences,
  firstParagraph,
  sentenceStarters,
  containsAny,
  countMatches,
} = require("../utils/emailTextUtils");

const BANNED_PHRASES = [
  "excited to apply",
  "i am excited",
  "thrilled to",
  "passionate about",
  "thank you for your consideration",
  "i believe my skills align",
  "i came across your posting",
  "i am writing to apply",
  "came across your job",
  "delve",
  "whether it's",
  "not just",
  "but also",
];

const ROBOTIC_WORDS = [
  "leverage",
  "utilize",
  "synergy",
  "robust",
  "comprehensive",
  "cutting-edge",
  "dynamic",
  "spearhead",
  "holistic",
];

const GENERIC_OPENERS = [
  "i am excited",
  "i am writing",
  "i came across",
  "dear hiring",
  "to whom it may",
];

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreBannedPhrases(body) {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const p of BANNED_PHRASES) {
    if (lower.includes(p)) hits += 1;
  }
  return clampScore(hits * 18);
}

function scoreAiPunctuation(body) {
  let score = 0;
  if (/—|–/.test(body)) score += 50;
  const semicolons = countMatches(body, /;/g);
  if (semicolons >= 3) score += semicolons * 12;
  if (/not just .+ but/i.test(body)) score += 25;
  if (/whether it's/i.test(body)) score += 20;
  return clampScore(score);
}

function scoreCadence(body) {
  const starters = sentenceStarters(body);
  let score = 0;
  let run = 1;
  for (let i = 1; i < starters.length; i++) {
    if (starters[i] && starters[i] === starters[i - 1]) {
      run += 1;
      if (run >= 3) score += 15;
    } else {
      run = 1;
    }
  }
  const paras = splitParagraphs(body);
  if (paras.length >= 3) {
    const lengths = paras.map((p) => wordCount(p));
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((s, l) => s + Math.abs(l - avg), 0) / lengths.length;
    if (variance < 8) score += 12;
  }
  return clampScore(score);
}

function scoreRepetition(body) {
  const sentences = splitSentences(body);
  const seen = new Set();
  let dupes = 0;
  for (const s of sentences) {
    const key = s.toLowerCase().slice(0, 40);
    if (seen.has(key)) dupes += 1;
    seen.add(key);
  }
  return clampScore(dupes * 20);
}

function scoreEnthusiasm(body) {
  const exclamations = countMatches(body, /!/g);
  let score = exclamations * 15;
  if (/amazing opportunity|incredible|thrilled/i.test(body)) score += 25;
  return clampScore(score);
}

function scoreRoboticLanguage(body) {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const w of ROBOTIC_WORDS) {
    if (lower.includes(w)) hits += 1;
  }
  return clampScore(hits * 14);
}

function scoreAdjectiveDensity(body) {
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length < 20) return 0;
  const adjLike = words.filter((w) =>
    /(ly|ful|ive|ous|ant|ent)$/.test(w.toLowerCase())
  ).length;
  const ratio = adjLike / words.length;
  return clampScore(ratio > 0.22 ? (ratio - 0.15) * 200 : 0);
}

function scoreGenericOpening(body, job) {
  const opening = firstParagraph(body).toLowerCase();
  let score = 0;
  for (const p of GENERIC_OPENERS) {
    if (opening.includes(p)) score += 25;
  }
  const role = (job?.title || "").toLowerCase();
  const company = (job?.company || "").toLowerCase();
  const preview = opening.slice(0, 120);
  if (role && !preview.includes(role.split(" ")[0])) score += 10;
  if (company && !preview.includes(company.split(" ")[0])) score += 8;
  return clampScore(score);
}

function scoreStackDumping(body, allowedTools) {
  const allowed = new Set((allowedTools || []).map((t) => t.toLowerCase()));
  const toolLike = body.match(/\b[A-Z][a-zA-Z+.0-9]{2,}\b/g) || [];
  const techTokens = body.match(
    /\b(?:react|node|python|java|aws|docker|kubernetes|figma|sql|typescript|javascript)\b/gi
  ) || [];
  const candidates = [...new Set([...toolLike, ...techTokens].map((t) => t.toLowerCase()))];
  let unknown = 0;
  for (const t of candidates) {
    if (t.length < 3) continue;
    const matched = [...allowed].some(
      (a) => a.includes(t) || t.includes(a)
    );
    if (!matched) unknown += 1;
  }
  return clampScore(unknown * 12);
}

function detectHallucinations(body, context) {
  const failures = [];
  const allowed = new Set((context?.allowedTools || []).map((t) => t.toLowerCase()));
  const techMentions =
    body.match(
      /\b(?:react|vue|angular|node\.?js|python|django|java|spring|aws|gcp|azure|kubernetes|docker|figma|sketch)\b/gi
    ) || [];
  for (const tech of techMentions) {
    const t = tech.toLowerCase();
    const ok = [...allowed].some((a) => a.includes(t.replace(".", "")) || t.includes(a));
    if (!ok && allowed.size > 0) {
      failures.push(`hallucinated_tool:${tech}`);
    }
  }
  if (/\b\d+\+?\s*years?\s*(?:of\s*)?experience\b/i.test(body)) {
    const resumeHasYears = JSON.stringify(context?.candidate || "").match(/\d+\s*years?/i);
    if (!resumeHasYears) {
      failures.push("hallucinated_years_experience");
    }
  }
  if (/\b(?:authorized to work|visa|h1b|green card|sponsorship)\b/i.test(body)) {
    const src = `${context?.rawJdText || ""} ${JSON.stringify(context?.candidate || "")}`;
    if (!/\b(?:visa|authorized|sponsorship|work authorization)\b/i.test(src)) {
      failures.push("hallucinated_work_authorization");
    }
  }
  return failures;
}

function computeCompositeRisk(signals) {
  const weights = {
    bannedPhraseScore: 0.18,
    aiPunctuationScore: 0.2,
    cadenceScore: 0.08,
    repetitionScore: 0.08,
    enthusiasmScore: 0.1,
    roboticLanguageScore: 0.1,
    adjectiveDensityScore: 0.06,
    genericOpeningScore: 0.12,
    stackDumpingScore: 0.08,
  };
  let total = 0;
  let w = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (signals[key] || 0) * weight;
    w += weight;
  }
  return clampScore(total / w);
}

function hasGreetingLikeOpening(body) {
  const first = firstParagraph(body).trim().toLowerCase();
  return /^(hi|hello|dear|good morning|good afternoon)\b/.test(first);
}

function hasSignoffLikeClosing(body) {
  const tail = body.trim().slice(-120).toLowerCase();
  return (
    /\b(best|regards|sincerely|thanks|thank you|cheers|kind regards)\b/.test(tail) ||
    /\n[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s*$/.test(body.trim())
  );
}

function validateEmailStructure(body, context = {}) {
  const validationWarnings = [];
  const hardFailures = [];
  const structureMode = context.emailPreferences?.structureMode || "balanced";
  const wc = wordCount(body);
  const paras = splitParagraphs(body);

  if (structureMode === "structured" || structureMode === "highly_scannable") {
    if (paras.length < 2) {
      hardFailures.push("broken_structure:missing_paragraph_separation");
    }
    const maxParaWords = structureMode === "highly_scannable" ? 100 : 140;
    for (const p of paras) {
      if (wordCount(p) > maxParaWords) {
        hardFailures.push("broken_structure:wall_of_text");
        break;
      }
    }
  }

  if (paras.length === 1 && wc > 180) {
    hardFailures.push("broken_structure:wall_of_text");
  }

  if (!hasGreetingLikeOpening(body)) {
    validationWarnings.push("structure:greeting_missing");
  }
  if (!hasSignoffLikeClosing(body)) {
    validationWarnings.push("structure:signoff_missing");
  }

  const range = context.emailPreferences?.targetWordRange;
  if (range) {
    if (wc < range.min * 0.6) {
      validationWarnings.push(`length:below_target:${wc}`);
    } else if (wc > range.max * 1.35) {
      validationWarnings.push(`length:above_target:${wc}`);
    }
  }

  return { hardFailures, validationWarnings };
}

/**
 * Weighted validation — soft signals + hard failures only for severe issues.
 */
function validateGeneratedEmail({ subject, body }, context = {}) {
  const sanitizedBody = body || "";
  const hardFailures = [];
  const validationWarnings = [];

  if (!sanitizedBody.trim()) {
    hardFailures.push("broken_structure:empty_body");
  }

  if (/[*#`]|^>\s/m.test(sanitizedBody)) {
    hardFailures.push("markdown_leakage");
  }

  if (/—|–/.test(sanitizedBody)) {
    hardFailures.push("ai_punctuation:em_en_dash");
  }

  const wc = wordCount(sanitizedBody);
  const paras = splitParagraphs(sanitizedBody);
  if (paras.length === 1 && wc > 180) {
    hardFailures.push("broken_structure:wall_of_text");
  }

  const structureResult = validateEmailStructure(sanitizedBody, context);
  hardFailures.push(...structureResult.hardFailures);
  validationWarnings.push(...structureResult.validationWarnings);

  const opening = firstParagraph(sanitizedBody).toLowerCase();
  const genericHits = GENERIC_OPENERS.filter((p) => opening.includes(p)).length;
  const role = (context.job?.title || "").toLowerCase();
  const company = (context.job?.company || "").toLowerCase();
  const preview = opening.slice(0, 80);
  const mentionsRole = role && preview.includes(role.split(" ")[0]);
  const mentionsCompany = company && preview.includes(company.split(" ")[0]);
  if (genericHits >= 2 && !mentionsRole && !mentionsCompany) {
    hardFailures.push("severe_genericity:opening");
  }

  hardFailures.push(...detectHallucinations(sanitizedBody, context));

  const validationSignals = {
    bannedPhraseScore: scoreBannedPhrases(sanitizedBody),
    aiPunctuationScore: scoreAiPunctuation(sanitizedBody),
    cadenceScore: scoreCadence(sanitizedBody),
    repetitionScore: scoreRepetition(sanitizedBody),
    enthusiasmScore: scoreEnthusiasm(sanitizedBody),
    roboticLanguageScore: scoreRoboticLanguage(sanitizedBody),
    adjectiveDensityScore: scoreAdjectiveDensity(sanitizedBody),
    genericOpeningScore: scoreGenericOpening(sanitizedBody, context.job),
    stackDumpingScore: scoreStackDumping(sanitizedBody, context.allowedTools),
    readabilityScore: 0,
  };

  const compositeRisk = computeCompositeRisk(validationSignals);

  const fixableHard = hardFailures.filter(
    (f) =>
      !f.startsWith("hallucinated_") &&
      f !== "broken_structure:empty_body"
  );

  const shouldRetry =
    fixableHard.length > 0 ||
    compositeRisk >= 70;

  return {
    hardFailures,
    validationWarnings,
    validationSignals,
    compositeRisk,
    shouldRetry,
    wordCount: wc,
  };
}

module.exports = {
  validateGeneratedEmail,
  validateEmailStructure,
  BANNED_PHRASES,
};
