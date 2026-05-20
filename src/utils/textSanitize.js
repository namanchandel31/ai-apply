const { MAX_LLM_INPUT_CHARS, MAX_STORAGE_TEXT_CHARS } = require("../config/parsingConfig");

/**
 * Remove NULL bytes and invalid UTF-8 sequences for Postgres TEXT columns.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeTextForStorage = (text, maxLen = MAX_STORAGE_TEXT_CHARS) => {
  if (text == null) return "";
  let s = String(text);
  // Strip NULL bytes (Postgres UTF8 rejects 0x00)
  s = s.replace(/\0/g, "");
  // Drop lone surrogate halves / other non-characters
  s = s.replace(/[\uD800-\uDFFF]/g, "");
  // 1. Protect Emails and URLs from normalization
  const protectedFragments = [];
  s = s.replace(/(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match) => {
    protectedFragments.push(match);
    return `__PROTECTED_${protectedFragments.length - 1}__`;
  });

  // 2. Fix hyphenated line wraps (e.g., appli-\ncations -> applications)
  s = s.replace(/([a-zA-Z]+)-\r?\n([a-zA-Z]+)/g, "$1$2");

  // 3. Normalize PDF glyph artifacts
  s = s.replace(/ï/g, " "); // Common broken glyph
  s = s.replace(/H\+91/g, "+91"); // Broken phone prefix artifact
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Remove zero-width characters

  // 4. Fix lightweight word merging (numbers and punctuation)
  s = s.replace(/(?<!\bv)([a-z])(\d)/g, "$1 $2"); // with5 -> with 5 (ignores v1)
  s = s.replace(/(\d)([a-zA-Z])/g, "$1 $2"); // 2025Apr -> 2025 Apr
  s = s.replace(/([•·])([a-zA-Z])/g, "$1 $2"); // bullet text -> bullet text
  s = s.replace(/\)([A-Za-z])/g, ") $1"); // (Remote)Apr -> (Remote) Apr

  // 5. Fix Section Boundary Spacing (camelCase un-merging)
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");

  // 6. Fix known merged resume vocabulary and restore tech stacks
  const vocabFixes = {
    // Re-merge tech stacks broken by camelCase split
    "Java Script": "JavaScript",
    "Type Script": "TypeScript",
    "Flutter Flow": "FlutterFlow",
    "Git Hub": "GitHub",
    "Git Lab": "GitLab",
    "Mac Book": "MacBook",
    "Word Press": "WordPress",
    "Linked In": "LinkedIn",
    "You Tube": "YouTube",
    "Power Shell": "PowerShell",
    "Get X": "GetX",
    "My SQL": "MySQL",
    "Postgre SQL": "PostgreSQL",
    "No SQL": "NoSQL",
    "Graph QL": "GraphQL",
    "Dev Ops": "DevOps",
    "i OS": "iOS",
    "mac OS": "macOS",
    "i Phone": "iPhone",
    "i Pad": "iPad",
    "Node. js": "Node.js",
    "Vue. js": "Vue.js",
    // Fix known missing spaces
    "yearsof": "years of",
    "scalingproduction": "scaling production",
    "developmentworkflows": "development workflows",
    "clientrequirements": "client requirements",
    "crossplatform": "cross platform",
  };
  for (const [split, merged] of Object.entries(vocabFixes)) {
    s = s.replace(new RegExp(`\\b${split}\\b`, "gi"), merged);
  }

  // Restore protected Emails and URLs
  s = s.replace(/__PROTECTED_(\d+)__/g, (match, p1) => {
    return protectedFragments[parseInt(p1, 10)];
  });

  // 7. Preserve structure (paragraphs, bullets)
  // Replace horizontal whitespace (spaces, tabs, non-breaking spaces) with a single space
  s = s.replace(/[ \t\f\v\xA0]+/g, " ");
  // Trim spaces at the beginning and end of each line
  s = s.replace(/^ +| +$/gm, "");
  // Collapse 3 or more newlines into double newlines (paragraph boundaries)
  s = s.replace(/\n{3,}/g, "\n\n");

  s = s.trim();
  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
  }
  return s;
};

/**
 * Sanitize PDF-extracted text before sending to OpenAI.
 * Normalizes whitespace and caps payload size.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
const sanitizeTextForLlm = (text, maxLen = MAX_LLM_INPUT_CHARS) => {
  const base = sanitizeTextForStorage(text, maxLen);
  if (base.length <= maxLen) return base;

  const keepStart = Math.floor(maxLen * 0.6);
  const keepEnd = maxLen - keepStart - 5;
  return `${base.slice(0, keepStart)} ... ${base.slice(base.length - keepEnd)}`;
};

/**
 * Safe error message for DB persistence.
 * @param {unknown} err
 * @param {number} maxLen
 */
const sanitizeErrorMessage = (err, maxLen = 2000) => {
  const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
  return sanitizeTextForStorage(msg, maxLen);
};

module.exports = {
  sanitizeTextForStorage,
  sanitizeTextForLlm,
  sanitizeErrorMessage,
};
