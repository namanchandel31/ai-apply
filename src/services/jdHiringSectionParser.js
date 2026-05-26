const HIRING_HEADER_PATTERNS = [
  /^open\s+positions?\s*:?\s*$/i,
  /^current\s+openings?\s*:?\s*$/i,
  /^vacancies\s*:?\s*$/i,
  /^roles?\s*(include|available)?\s*:?\s*$/i,
  /^hiring\s+for\s*:?\s*$/i,
  /^we\s+are\s+hiring\s*:?\s*$/i,
  /^we'?re\s+hiring\s*:?\s*$/i,
  /^looking\s+for\s*:?\s*$/i,
  /^actively\s+hiring\s*:?\s*$/i,
  /^join\s+our\s+team\s*:?\s*$/i,
  /^we'?re\s+expanding\s+(our\s+)?team\s*:?\s*$/i,
];

const HIRING_INLINE_PATTERNS = [
  /\b(hiring\s+for|looking\s+for|open\s+positions?|we\s+are\s+hiring|actively\s+hiring)\b/i,
];

const NON_ROLE_BULLET_PATTERNS = [
  { reason: "soft_skill", re: /\b(communication|leadership|teamwork|passion|interpersonal)\b/i },
  { reason: "benefit", re: /\b(salary|compensation|benefits|flexible\s+hours|pto|equity)\b/i },
  { reason: "trait", re: /\b(self[- ]?starter|go[- ]?getter|fast[- ]?paced|rockstar|ninja)\b/i },
  { reason: "contact", re: /\b(email|phone|dm\s+me|whatsapp|telegram|@\w+\.\w+)\b/i },
  { reason: "requirement", re: /\b(\d+\+?\s*years?\s+of\s+experience|bachelor|master|degree)\b/i },
];

const BULLET_PREFIX = /^[\s]*(?:[-*•●▪▫]|\d+[.)])\s+/;

function isHiringHeader(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (HIRING_HEADER_PATTERNS.some((re) => re.test(trimmed))) return true;
  return HIRING_INLINE_PATTERNS.some((re) => re.test(trimmed)) && trimmed.length < 120;
}

function classifyNonRoleBullet(text) {
  for (const { reason, re } of NON_ROLE_BULLET_PATTERNS) {
    if (re.test(text)) return reason;
  }
  return null;
}

function stripBullet(line) {
  return line.replace(BULLET_PREFIX, "").trim();
}

function extractRolesFromLine(line) {
  const cleaned = stripBullet(line).replace(/^hiring\s+for\s*:?\s*/i, "").trim();
  if (!cleaned || classifyNonRoleBullet(cleaned)) return [];

  if (cleaned.includes(",")) {
    return cleaned
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && !classifyNonRoleBullet(s));
  }
  if (cleaned.length >= 3) return [cleaned];
  return [];
}

/**
 * @param {string} rawText
 */
function parseHiringSections(rawText) {
  const lines = String(rawText || "").split(/\r?\n/);
  /** @type {{ header: string|null, type: string, lines: string[], startLine: number, endLine: number }[]} */
  const sections = [];
  /** @type {{ raw: string, sectionIndex: number, lineIndex: number }[]} */
  const roleCandidates = [];
  /** @type {{ raw: string, reason: string }[]} */
  const excludedBullets = [];

  let current = {
    header: null,
    type: "other",
    lines: [],
    startLine: 0,
    endLine: 0,
  };

  function flushSection() {
    if (current.lines.length || current.header) {
      current.endLine = current.startLine + Math.max(0, current.lines.length - 1);
      sections.push({ ...current, lines: [...current.lines] });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isHiringHeader(trimmed)) {
      flushSection();
      current = {
        header: trimmed,
        type: "hiring_roles",
        lines: [],
        startLine: i,
        endLine: i,
      };
      const inlineRoles = extractRolesFromLine(trimmed);
      for (const raw of inlineRoles) {
        roleCandidates.push({ raw, sectionIndex: sections.length, lineIndex: i });
      }
      continue;
    }

    if (!current.lines.length && !current.header) {
      current.startLine = i;
    }
    current.lines.push(line);

    const isBullet = BULLET_PREFIX.test(trimmed) || /^\d+[.)]\s/.test(trimmed);
    if (isBullet) {
      const content = stripBullet(trimmed);
      const nonRole = classifyNonRoleBullet(content);
      if (nonRole) {
        excludedBullets.push({ raw: content, reason: nonRole });
        continue;
      }
      if (current.type === "hiring_roles") {
        for (const raw of extractRolesFromLine(trimmed)) {
          roleCandidates.push({ raw, sectionIndex: sections.length, lineIndex: i });
        }
      }
    } else if (current.type === "hiring_roles" && trimmed.length >= 3) {
      const nonRole = classifyNonRoleBullet(trimmed);
      if (!nonRole) {
        for (const raw of extractRolesFromLine(trimmed)) {
          roleCandidates.push({ raw, sectionIndex: sections.length, lineIndex: i });
        }
      }
    }
  }
  flushSection();

  const inlinePatterns = [
    /(?:we'?re\s+)?hiring\s+for\s+([^.!\n]+)/gi,
    /looking\s+for\s+([^.!\n]+)/gi,
    /actively\s+hiring\s+([^.!\n]+)/gi,
  ];
  for (const re of inlinePatterns) {
    let match;
    while ((match = re.exec(rawText)) !== null) {
      for (const raw of extractRolesFromLine(match[1])) {
        roleCandidates.push({ raw, sectionIndex: -1, lineIndex: 0 });
      }
    }
  }

  // Fallback: scan all bullets in document if no hiring section found roles
  if (!roleCandidates.length) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!BULLET_PREFIX.test(trimmed) && !/^\d+[.)]\s/.test(trimmed)) continue;
      const content = stripBullet(trimmed);
      const nonRole = classifyNonRoleBullet(content);
      if (nonRole) {
        excludedBullets.push({ raw: content, reason: nonRole });
        continue;
      }
      const looksLikeRole =
        /\b(developer|engineer|designer|manager|architect|analyst|intern)\b/i.test(content);
      if (looksLikeRole) {
        for (const raw of extractRolesFromLine(trimmed)) {
          roleCandidates.push({ raw, sectionIndex: -1, lineIndex: i });
        }
      }
    }
  }

  return { sections, roleCandidates, excludedBullets };
}

module.exports = {
  parseHiringSections,
  isHiringHeader,
  classifyNonRoleBullet,
};
