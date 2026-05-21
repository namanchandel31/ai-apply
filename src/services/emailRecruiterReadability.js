const {
  wordCount,
  splitParagraphs,
  splitSentences,
  firstParagraph,
  sentenceLengths,
  paragraphLengths,
} = require("../utils/emailTextUtils");
const { scoreOpeningStrength } = require("./emailOpeningStrength");

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreRecruiterReadability({ subject, body, job }) {
  const text = body || "";
  const opening = scoreOpeningStrength({ body: text, job });
  const preview = firstParagraph(text).slice(0, 120);
  const previewWords = wordCount(preview);

  let mobilePreviewScore = 70;
  const role = (job?.title || "").toLowerCase();
  const company = (job?.company || "").toLowerCase();
  if (role && preview.toLowerCase().includes(role.split(" ")[0])) {
    mobilePreviewScore += 15;
  } else {
    mobilePreviewScore -= 20;
  }
  if (company && preview.toLowerCase().includes(company.split(" ")[0])) {
    mobilePreviewScore += 10;
  }
  if (previewWords < 8) mobilePreviewScore -= 15;

  const sentences = splitSentences(text);
  const lengths = sentenceLengths(text);
  const avgLen =
    lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  let sentenceFriction = 75;
  const veryLong = lengths.filter((l) => l > 28).length;
  const veryShort = lengths.filter((l) => l < 6).length;
  if (veryLong >= 2) sentenceFriction -= 20;
  if (avgLen > 22) sentenceFriction -= 12;
  if (veryShort === 0 && sentences.length > 4) sentenceFriction -= 8;

  const paras = splitParagraphs(text);
  const pLengths = paragraphLengths(text);
  const maxPara = pLengths.length ? Math.max(...pLengths) : 0;
  let cognitiveLoad = 80;
  if (maxPara > 90) cognitiveLoad -= 25;
  if (paras.length === 1 && wordCount(text) > 150) cognitiveLoad -= 30;
  if (paras.length >= 4) cognitiveLoad += 5;

  let paragraphFlow = 75;
  if (paras.length >= 2 && paras.length <= 4) paragraphFlow += 10;
  if (pLengths.length >= 2) {
    const spread = Math.max(...pLengths) - Math.min(...pLengths);
    if (spread >= 15) paragraphFlow += 8;
  }

  const totalWords = wordCount(text);
  const fillerBeforeValue =
    preview.length > 80 && !role
      ? 30
      : preview.match(/^(hi|hello|dear).{0,40}$/i)
        ? 15
        : 0;
  const informationDensity = clamp(
    100 - fillerBeforeValue - (totalWords > 220 ? 15 : 0)
  );

  const scanSpeed = clamp(
    (opening.score + mobilePreviewScore) / 2 +
      (role && preview.toLowerCase().includes(role.split(" ")[0]) ? 10 : 0)
  );

  const overall = clamp(
    opening.score * 0.25 +
      mobilePreviewScore * 0.2 +
      sentenceFriction * 0.15 +
      informationDensity * 0.15 +
      scanSpeed * 0.15 +
      (100 - cognitiveLoad) * 0.05 +
      paragraphFlow * 0.05
  );

  return {
    firstLineStrength: opening.score,
    mobilePreviewScore: clamp(mobilePreviewScore),
    sentenceFriction: clamp(sentenceFriction),
    informationDensity,
    scanSpeed,
    paragraphFlow: clamp(paragraphFlow),
    cognitiveLoad: clamp(100 - cognitiveLoad),
    overall,
    subject: subject || "",
  };
}

module.exports = { scoreRecruiterReadability };
