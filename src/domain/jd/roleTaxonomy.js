const ROLE_ALIASES = Object.freeze({
  "flutter developer": "Flutter Developer",
  "flutter developers": "Flutter Developer",
  "flutter dev": "Flutter Developer",
  "flutter devs": "Flutter Developer",
  "nodejs developer": "Node.js Developer",
  "node.js developer": "Node.js Developer",
  "node developer": "Node.js Developer",
  "node js developer": "Node.js Developer",
  "react developer": "React Developer",
  "react developers": "React Developer",
  "python developer": "Python Developer",
  "python developers": "Python Developer",
  "ai/ml engineer": "AI/ML Engineer",
  "ai/ml engineers": "AI/ML Engineer",
  "aiml engineer": "AI/ML Engineer",
  "machine learning engineer": "AI/ML Engineer",
  "ml engineer": "AI/ML Engineer",
  "data engineer": "Data Engineer",
  "data engineers": "Data Engineer",
  "backend engineer": "Backend Engineer",
  "backend developers": "Backend Engineer",
  "frontend engineer": "Frontend Engineer",
  "frontend developers": "Frontend Engineer",
  "full stack developer": "Full Stack Developer",
  "fullstack developer": "Full Stack Developer",
  "software engineer": "Software Engineer",
  "software developers": "Software Engineer",
  "mobile developer": "Mobile Developer",
  "ios developer": "iOS Developer",
  "android developer": "Android Developer",
  "devops engineer": "DevOps Engineer",
  "product manager": "Product Manager",
});

function collapseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[^\w\s./+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeRole(word) {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith("ies")) return word.slice(0, -3) + "y";
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes")) {
    return word.slice(0, -2);
  }
  if (lower.endsWith("s") && !lower.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function titleCaseFallback(raw) {
  const parts = collapseKey(raw).split(" ").filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = singularizeRole(last);
  return parts
    .map((p) => {
      if (p === "ai/ml") return "AI/ML";
      if (p === "ios") return "iOS";
      if (p === "devops") return "DevOps";
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyAliasLookup(key) {
  if (ROLE_ALIASES[key]) {
    return { canonical: ROLE_ALIASES[key], matchedAlias: key, confidence: 0.95 };
  }
  const keys = Object.keys(ROLE_ALIASES);
  let best = null;
  let bestDist = Infinity;
  for (const alias of keys) {
    const dist = levenshtein(key, alias);
    const threshold = alias.length <= 8 ? 1 : 2;
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = alias;
    }
  }
  if (best) {
    return { canonical: ROLE_ALIASES[best], matchedAlias: best, confidence: 0.75 };
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {{ canonical: string|null, confidence: number, matchedAlias?: string, source: string }}
 */
function normalizeRoleTitle(raw) {
  let input = raw;
  const hiringInline = collapseKey(raw).match(
    /(?:hiring for|looking for|open positions?)\s+(.+)$/
  );
  if (hiringInline?.[1]) {
    input = hiringInline[1].replace(/\.\s*.*/, "").trim();
  }

  const key = collapseKey(input);
  if (!key || key.length < 3) {
    return { canonical: null, confidence: 0, source: "empty" };
  }
  if (key.split(" ").length > 8) {
    return { canonical: null, confidence: 0, source: "sentence_not_role" };
  }

  const exact = fuzzyAliasLookup(key);
  if (exact) {
    return { ...exact, source: "alias" };
  }

  const fallback = titleCaseFallback(raw);
  if (fallback && fallback.length >= 4) {
    return { canonical: fallback, confidence: 0.55, source: "title_case_fallback" };
  }

  return { canonical: null, confidence: 0, source: "unrecognized" };
}

module.exports = {
  ROLE_ALIASES,
  collapseKey,
  normalizeRoleTitle,
};
