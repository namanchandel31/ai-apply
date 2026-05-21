const PROMPT_VERSION = "email_generate_v2";

const SYSTEM_PROMPT = `You write real job application emails that sound like a competent professional reaching out directly.

Target: credible, easy to skim in a few seconds. NOT perfect writing, NOT a cover letter, NOT LinkedIn-influencer tone.

Output ONLY valid JSON:
{
  "subject": "string (5-120 chars)",
  "body": "string (plain text, 120-220 words)"
}

STRICT BANS (never use):
- "I am excited to apply", "I believe my skills align", "thank you for your consideration"
- "I can contribute immediately", "I am passionate about", "thrilled to", "delve"
- "not just X, but Y", "whether it's"
- Em dash (—) or en dash (–). Use commas and periods only.
- Markdown, bullet lists, bold, headers
- Tool/stack dumping unless tools appear in BOTH job requirements AND candidate data provided
- Invented experience, companies, years, tools, relocation, or visa/work authorization

WRITING STYLE:
- 120-220 words, lightweight email
- Role and company referenced naturally in the first 1-2 sentences (Gmail preview survival)
- Mention 2-4 matching skills/experiences from provided data only
- Slight natural imperfection OK: uneven paragraph sizes, varied sentence length, not every paragraph symmetrical
- Do NOT over-polish transitions or make every sentence equally smooth
- Vary sentence openings; avoid three consecutive "I have" / "I am" starts
- Use tone guidance from user prompt (startup/enterprise/agency/remote) as style hints, NOT fill-in templates
- Busy-professional tone: direct, grounded, specific, respectful

STRUCTURE:
- Greeting
- Short personalized opening with early relevance
- Why candidate fits THIS role (specific)
- 2-4 matching points from provided data
- Resume attachment mention (natural, brief)
- Short CTA
- Professional signoff with candidate name if provided`;

function formatCandidateBlock(candidate) {
  const lines = [];
  if (candidate.name) lines.push(`Name: ${candidate.name}`);
  if (candidate.location) lines.push(`Location: ${candidate.location}`);
  if (candidate.summary) lines.push(`Summary: ${candidate.summary}`);
  if (candidate.skills?.length) {
    lines.push(`Skills: ${candidate.skills.join(", ")}`);
  }
  if (candidate.experience?.length) {
    lines.push("Recent experience:");
    for (const exp of candidate.experience) {
      const parts = [exp.role, exp.company].filter(Boolean).join(" at ");
      lines.push(`- ${parts || "Role"}${exp.description ? `: ${exp.description}` : ""}`);
    }
  }
  return lines.join("\n");
}

function formatJobBlock(job) {
  const lines = [];
  if (job.title) lines.push(`Role: ${job.title}`);
  if (job.company) lines.push(`Company: ${job.company}`);
  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.jobType) lines.push(`Work mode: ${job.jobType}`);
  if (job.requiredSkills?.length) {
    lines.push(`Key requirements: ${job.requiredSkills.join(", ")}`);
  }
  return lines.join("\n");
}

function formatToneBlock(toneContext) {
  if (!toneContext) return "";
  return [
    "Tone guidance (adapt style, do not copy templates):",
    `- Company style: ${toneContext.companyStyle}`,
    `- Communication: ${toneContext.communicationTone}`,
    `- Hiring signal: ${toneContext.hiringSignal}`,
    `- Environment: ${toneContext.environmentType}`,
  ].join("\n");
}

function formatPersonalizationBlock(personalizationContext) {
  if (!personalizationContext || !Object.keys(personalizationContext).length) {
    return "Personalization: none (do not invent names or company facts).";
  }
  const lines = ["High-confidence personalization (use only if natural):"];
  for (const [key, value] of Object.entries(personalizationContext)) {
    if (value != null && value !== "") {
      lines.push(`- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
  }
  return lines.join("\n");
}

function buildEmailUserPrompt({
  candidate,
  job,
  match,
  toneContext,
  personalizationContext,
}) {
  let matchGuidance;
  if (match.score === 0 || !match.matchedSkills?.length) {
    matchGuidance =
      "Match is weak. Emphasize adaptability and relevant general experience only. Do NOT invent specific skills.";
  } else {
    matchGuidance = `Matched skills to reference (only these): ${match.matchedSkills.join(", ")}. Do NOT mention missing requirements as if the candidate has them.`;
  }

  const relocationNote = [];
  if (job.location && candidate.location) {
    relocationNote.push(
      `Candidate location: ${candidate.location}. Job location: ${job.location}. Mention relocation ONLY if both are present and relevant.`
    );
  }
  if (job.jobType === "Remote") {
    relocationNote.push("Remote role: mention async/ownership only if natural, not as buzzwords.");
  }

  return [
    "Analyze the job and candidate data below, then write the email.",
    "",
    "=== JOB ===",
    formatJobBlock(job),
    "",
    "=== CANDIDATE (use ONLY this data) ===",
    formatCandidateBlock(candidate),
    "",
    "=== MATCH ===",
    matchGuidance,
    match.score > 0 ? `Match score: ${match.score}%` : "",
    "",
    formatToneBlock(toneContext),
    "",
    formatPersonalizationBlock(personalizationContext),
    relocationNote.length ? relocationNote.join("\n") : "",
    "",
    "Do not mention work authorization or visa status unless explicitly stated above.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRetryUserPrompt({
  priorDraft,
  critique,
  rewriteGuidance,
  candidate,
  job,
}) {
  return [
    "Revise the draft email below. Keep strong paragraphs unchanged; rewrite ONLY the sections flagged.",
    "",
    `Role: ${job.title || "the role"} at ${job.company || "the company"}`,
    `Candidate: ${candidate.name || "the candidate"}`,
    "",
    "=== CRITIQUE ===",
    critique,
    "",
    "=== TARGETED REWRITE GUIDANCE ===",
    rewriteGuidance,
    "",
    "=== PRIOR DRAFT ===",
    `Subject: ${priorDraft.subject}`,
    "",
    priorDraft.body,
    "",
    "Output revised JSON with subject and body. Same rules as initial generation.",
  ].join("\n");
}

module.exports = {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildEmailUserPrompt,
  buildRetryUserPrompt,
};
