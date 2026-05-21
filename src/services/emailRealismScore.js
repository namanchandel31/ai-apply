const { sentenceLengths, paragraphLengths, wordCount } = require("../utils/emailTextUtils");

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function variance(nums) {
  if (!nums.length) return 0;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, n) => s + (n - avg) ** 2, 0) / nums.length;
}

function scoreEmailRealism({ subject, body, context, validationSignals, openingStrength, recruiterReadability }) {
  const text = body || "";
  const signals = validationSignals || {};

  let humanRelatability = 75;
  humanRelatability -= (signals.bannedPhraseScore || 0) * 0.35;
  humanRelatability -= (signals.roboticLanguageScore || 0) * 0.25;
  humanRelatability -= (signals.enthusiasmScore || 0) * 0.2;
  const sentVar = variance(sentenceLengths(text));
  const paraVar = variance(paragraphLengths(text));
  if (sentVar > 20) humanRelatability += 8;
  if (paraVar > 50) humanRelatability += 6;
  if (sentVar < 5 && wordCount(text) > 100) humanRelatability -= 10;

  let specificity = 50;
  if (context?.job?.title) specificity += 15;
  if (context?.job?.company) specificity += 12;
  if (context?.match?.matchedSkills?.length) {
    specificity += Math.min(25, context.match.matchedSkills.length * 5);
  }
  if (openingStrength?.strengths?.includes("role_named_early")) specificity += 10;

  let personalizationQuality = 40;
  const used = context?.personalizationUsed?.length || 0;
  personalizationQuality += used * 12;
  if (context?.personalizationContext?.recruiterName) {
    personalizationQuality += 10;
  }

  let aiDetectabilityRisk = signals.compositeRisk ?? 0;
  if (typeof signals === "object" && !signals.compositeRisk) {
    aiDetectabilityRisk =
      (signals.aiPunctuationScore || 0) * 0.35 +
      (signals.bannedPhraseScore || 0) * 0.2 +
      (signals.cadenceScore || 0) * 0.1 +
      (signals.roboticLanguageScore || 0) * 0.2 +
      (signals.adjectiveDensityScore || 0) * 0.15;
  }
  if (/—|–/.test(text)) aiDetectabilityRisk += 30;
  if (sentVar < 8) aiDetectabilityRisk += 12;

  const overall = clamp(
    humanRelatability * 0.3 +
      specificity * 0.25 +
      (recruiterReadability?.overall ?? 60) * 0.25 +
      personalizationQuality * 0.1 +
      (100 - aiDetectabilityRisk) * 0.1
  );

  return {
    humanRelatability: clamp(humanRelatability),
    specificity: clamp(specificity),
    personalizationQuality: clamp(personalizationQuality),
    aiDetectabilityRisk: clamp(aiDetectabilityRisk),
    overall,
    subject: subject || "",
  };
}

module.exports = { scoreEmailRealism };
