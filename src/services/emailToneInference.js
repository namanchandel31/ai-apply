/**
 * Heuristic tone inference from JD text — guides style, not templates.
 */

function scoreKeywords(text, patterns) {
  const lower = String(text || "").toLowerCase();
  let score = 0;
  for (const p of patterns) {
    if (lower.includes(p)) score += 1;
  }
  return score;
}

function inferToneContext({ rawJdText, parsedJd }) {
  const text = `${rawJdText || ""} ${parsedJd?.job_title || ""} ${parsedJd?.company_name || ""}`;

  const startupScore = scoreKeywords(text, [
    "startup",
    "fast-paced",
    "wear many hats",
    "early stage",
    "series a",
    "series b",
    "equity",
    "founding",
    "scrappy",
    "move fast",
  ]);
  const enterpriseScore = scoreKeywords(text, [
    "enterprise",
    "fortune",
    "global team",
    "stakeholder",
    "compliance",
    "governance",
    "established",
    "structured process",
    "cross-functional",
  ]);
  const agencyScore = scoreKeywords(text, [
    "agency",
    "client",
    "campaign",
    "portfolio",
    "creative team",
    "brand",
    "pitch",
  ]);
  const remoteScore = scoreKeywords(text, [
    "remote",
    "async",
    "distributed",
    "work from anywhere",
    "timezone",
    "fully remote",
  ]);
  const urgencyScore = scoreKeywords(text, [
    "asap",
    "immediate",
    "urgent",
    "start immediately",
    "hiring quickly",
  ]);
  const designScore = scoreKeywords(text, [
    "figma",
    "design system",
    "ux",
    "ui",
    "user research",
    "prototype",
  ]);
  const engineeringScore = scoreKeywords(text, [
    "api",
    "backend",
    "frontend",
    "deploy",
    "ci/cd",
    "kubernetes",
    "microservice",
  ]);

  let companyStyle = "unknown";
  const styleScores = [
    ["startup", startupScore],
    ["enterprise", enterpriseScore],
    ["agency", agencyScore],
  ];
  styleScores.sort((a, b) => b[1] - a[1]);
  if (styleScores[0][1] > 0) companyStyle = styleScores[0][0];

  let communicationTone = "direct";
  if (enterpriseScore > startupScore && enterpriseScore > 0) {
    communicationTone = "polished";
  } else if (agencyScore > 0) {
    communicationTone = "creative";
  } else if (startupScore > 0) {
    communicationTone = "concise";
  }

  let hiringSignal = "unknown";
  if (urgencyScore >= 2) hiringSignal = "urgency";
  else if (startupScore > 0) hiringSignal = "growth";
  else if (enterpriseScore > 0) hiringSignal = "stability";

  let environmentType = "unknown";
  if (parsedJd?.job_type === "Remote" || remoteScore >= 2) {
    environmentType = "remote_first";
  } else if (parsedJd?.job_type === "Hybrid") {
    environmentType = "hybrid";
  } else if (parsedJd?.job_type === "Onsite") {
    environmentType = "onsite";
  } else if (remoteScore > 0) {
    environmentType = "remote_first";
  }

  const toneType = [
    companyStyle !== "unknown" ? companyStyle : null,
    communicationTone,
    environmentType !== "unknown" ? environmentType : null,
  ]
    .filter(Boolean)
    .join("_");

  const styleHint =
    companyStyle === "startup"
      ? "concise, adaptable, execution-focused"
      : companyStyle === "enterprise"
        ? "polished, structured"
        : companyStyle === "agency"
          ? "creative, collaborative"
          : environmentType === "remote_first"
            ? "ownership, async communication"
            : designScore > engineeringScore
              ? "design thinking, product sense"
              : engineeringScore > 0
                ? "problem-solving, shipping experience"
                : "direct professional";

  return {
    companyStyle,
    communicationTone,
    hiringSignal,
    environmentType,
    toneType: toneType || "direct_unknown",
    styleHint,
  };
}

module.exports = { inferToneContext };
