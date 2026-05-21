/** Shared text helpers for email quality pipeline. */

function wordCount(text) {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitParagraphs(body) {
  if (!body) return [];
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/-/g, " ");
}

function firstParagraph(body) {
  const paras = splitParagraphs(body);
  return paras[0] || body || "";
}

function sentenceStarters(body) {
  return splitSentences(body).map((s) => {
    const words = s.split(/\s+/);
    return (words[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  });
}

function sentenceLengths(body) {
  return splitSentences(body).map((s) => s.split(/\s+/).filter(Boolean).length);
}

function paragraphLengths(body) {
  return splitParagraphs(body).map((p) => wordCount(p));
}

function containsAny(text, patterns) {
  const lower = String(text || "").toLowerCase();
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function countMatches(text, regex) {
  const m = String(text || "").match(regex);
  return m ? m.length : 0;
}

module.exports = {
  wordCount,
  splitParagraphs,
  splitSentences,
  normalizeForMatch,
  firstParagraph,
  sentenceStarters,
  sentenceLengths,
  paragraphLengths,
  containsAny,
  countMatches,
};
