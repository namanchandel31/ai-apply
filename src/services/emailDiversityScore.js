const crypto = require("crypto");
const { firstParagraph, sentenceStarters, paragraphLengths } = require("../utils/emailTextUtils");

function classifyOpenerShape(opening) {
  const lower = opening.toLowerCase().trim();
  if (lower.startsWith("hi ")) return "hi_name";
  if (lower.startsWith("hello ")) return "hello";
  if (lower.includes("noticed")) return "noticed";
  if (lower.includes("for the")) return "for_the_role";
  if (lower.startsWith("i ")) return "i_opener";
  return "other";
}

function scoreDiversityFingerprint({ body }) {
  const opening = firstParagraph(body || "");
  const openerPattern = classifyOpenerShape(opening);
  const pLengths = paragraphLengths(body || "");
  const paragraphStructure = pLengths.join("-") || "empty";
  const starters = sentenceStarters(body || "");
  const starterDist = starters.slice(0, 6).join(",");
  const cadenceFingerprint = crypto
    .createHash("sha1")
    .update(`${openerPattern}|${paragraphStructure}|${starterDist}`)
    .digest("hex")
    .slice(0, 12);

  const lengths = pLengths;
  const spread =
    lengths.length > 1 ? Math.max(...lengths) - Math.min(...lengths) : 0;
  let diversityScore = 70;
  if (spread >= 20) diversityScore += 15;
  if (openerPattern !== "i_opener") diversityScore += 10;
  if (lengths.length >= 2 && lengths.length <= 4) diversityScore += 5;

  return {
    openerPattern,
    paragraphStructure,
    cadenceFingerprint,
    diversityScore: Math.max(0, Math.min(100, diversityScore)),
  };
}

module.exports = { scoreDiversityFingerprint };
