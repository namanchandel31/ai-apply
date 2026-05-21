const { splitParagraphs, splitSentences, sentenceStarters } = require("../utils/emailTextUtils");

function synthesizeEmailCritique({
  hardFailures = [],
  validationSignals = {},
  scores = {},
  openingAnalysis = {},
  draft = {},
}) {
  const lines = [];

  if (hardFailures.length) {
    lines.push("Hard issues to fix:");
    for (const f of hardFailures) {
      lines.push(`- ${f}`);
    }
  }

  if (openingAnalysis.weakPatterns?.length) {
    lines.push(
      `Opening feels generic (${openingAnalysis.weakPatterns.join(", ")}). Role/company should appear in the first 1-2 sentences for Gmail preview.`
    );
  } else if ((openingAnalysis.score ?? 100) < 50) {
    lines.push(
      "Opening is weak: relevance to the role is buried or missing in the first paragraph."
    );
  }

  if ((validationSignals.bannedPhraseScore ?? 0) >= 40) {
    lines.push(
      "Body uses banned corporate/AI phrases that recruiters recognize as templates."
    );
  }

  if ((validationSignals.aiPunctuationScore ?? 0) >= 30) {
    lines.push(
      "Punctuation feels AI-generated (dashes, semicolons, or polished contrast constructions)."
    );
  }

  if ((validationSignals.stackDumpingScore ?? 0) >= 35) {
    lines.push(
      "A paragraph lists tools/stacks not supported by the candidate match data."
    );
  }

  const starters = sentenceStarters(draft.body || "");
  let run = 1;
  for (let i = 1; i < starters.length; i++) {
    if (starters[i] === starters[i - 1] && starters[i]) {
      run += 1;
      if (run >= 3) {
        lines.push(
          `Three or more consecutive sentences start with "${starters[i]}" — vary openings.`
        );
        break;
      }
    } else {
      run = 1;
    }
  }

  if ((scores.recruiterReadability?.cognitiveLoad ?? 100) < 50) {
    lines.push(
      "Middle section is dense (wall-of-text); breaks mobile skim readability."
    );
  }

  if ((scores.realism?.aiDetectabilityRisk ?? 0) >= 70) {
    lines.push(
      "Overall tone reads as linguistically optimized rather than a quick note from a working professional."
    );
  }

  if ((validationSignals.roboticLanguageScore ?? 0) >= 30) {
    lines.push(
      "Several sentences use corporate buzzwords (leverage, utilize, robust) instead of plain language."
    );
  }

  if (!lines.length) {
    lines.push(
      "Email is acceptable but could be more direct in the opening and slightly less polished in transitions."
    );
  }

  return lines.join("\n");
}

function buildTargetedRewriteGuidance(critique, draft = {}) {
  const paras = splitParagraphs(draft.body || "");
  const guidance = [];

  if (/opening|first|preview|generic/i.test(critique)) {
    guidance.push(
      `REWRITE ONLY paragraph 1 (opening): ${paras[0]?.slice(0, 60) || "opening"}... — keep other paragraphs unchanged.`
    );
  }

  if (/dense|wall|middle|skim/i.test(critique)) {
    const idx = paras.length > 2 ? 1 : 0;
    guidance.push(
      `REWRITE ONLY paragraph ${idx + 1} to split long sentences and reduce density. Leave other paragraphs as-is.`
    );
  }

  if (/tool|stack/i.test(critique)) {
    guidance.push(
      "REWRITE ONLY sentences that list tools; keep only skills from the provided match data."
    );
  }

  if (/consecutive|openings|"I/i.test(critique)) {
    guidance.push(
      "REWRITE ONLY the sentences with repeated starters; vary how sentences begin."
    );
  }

  if (/punctuation|dash|semicolon/i.test(critique)) {
    guidance.push(
      "Fix punctuation in flagged sections only: use commas and periods, no em/en dashes."
    );
  }

  if (/banned|corporate|phrases/i.test(critique)) {
    guidance.push(
      "Replace generic phrases in the opening and closing only; do not rewrite the whole email."
    );
  }

  if (/buzzword|robotic/i.test(critique)) {
    guidance.push(
      "Simplify wording in 1-2 sentences that sound corporate; keep factual content."
    );
  }

  if (!guidance.length) {
    guidance.push(
      "Tighten the opening paragraph and one middle sentence; preserve the rest of the draft."
    );
  }

  guidance.push(
    "Keep strong paragraphs verbatim. Do not regenerate the entire email."
  );

  return guidance.join("\n");
}

module.exports = {
  synthesizeEmailCritique,
  buildTargetedRewriteGuidance,
};
