const { firstParagraph, wordCount, containsAny } = require("../utils/emailTextUtils");

const WEAK_OPENERS = [
  "i am excited to apply",
  "i am excited",
  "i came across your posting",
  "i came across your job",
  "i am writing to apply",
  "i am writing to express",
  "thank you for considering",
  "to whom it may concern",
  "dear hiring manager",
  "i hope this email finds you",
];

function scoreOpeningStrength({ body, job }) {
  const opening = firstParagraph(body || "");
  const preview = opening.slice(0, 120);
  const weakPatterns = WEAK_OPENERS.filter((p) =>
    opening.toLowerCase().includes(p)
  );

  let score = 70;
  const strengths = [];

  if (weakPatterns.length) {
    score -= weakPatterns.length * 22;
  }

  const role = (job?.title || "").trim();
  const company = (job?.company || "").trim();
  const lowerPreview = preview.toLowerCase();

  if (role) {
    const roleToken = role.toLowerCase().split(" ")[0];
    if (lowerPreview.includes(roleToken)) {
      score += 12;
      strengths.push("role_named_early");
    } else {
      score -= 15;
    }
  }

  if (company) {
    const companyToken = company.toLowerCase().split(" ")[0];
    if (lowerPreview.includes(companyToken)) {
      score += 10;
      strengths.push("company_named_early");
    }
  }

  if (containsAny(opening, ["i noticed you're", "i saw the", "for the"])) {
    score += 8;
    strengths.push("contextual_hook");
  }

  if (wordCount(opening) > 55) {
    score -= 10;
  }

  if (preview.length < 40 && role) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    weakPatterns,
    strengths,
    previewLength: preview.length,
  };
}

module.exports = { scoreOpeningStrength };
