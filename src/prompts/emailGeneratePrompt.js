const PROMPT_VERSION = "email_generate_v4";

const SYSTEM_PROMPT_BASE = `You write real job application emails that sound like a competent professional reaching out directly.

Target: credible, easy to skim in a few seconds. NOT perfect writing, NOT a cover letter, NOT LinkedIn-influencer tone.

Output ONLY valid JSON:
{
  "subject": "string (5-120 chars)",
  "body": "string (plain text)"
}

MANDATORY EMAIL SHAPE (every body must follow this letter format):
1. Salutation on its own first line (e.g. "Hi," or "Hello,")
2. Body paragraphs in the middle (tone/length/structure guidance applies HERE only)
3. Sign-off phrase on its own line before the name (e.g. "Best regards," or "Thanks,")
4. Sender full name on the final line (from candidate data)

Use blank lines between salutation, body paragraphs, sign-off, and name. Never output one uninterrupted paragraph for the entire email.

STRICT BANS (never use):
- "I am excited to apply", "I believe my skills align", "thank you for your consideration"
- "I can contribute immediately", "I am passionate about", "thrilled to", "delve"
- "not just X, but Y", "whether it's"
- Em dash (—) or en dash (–). Use commas and periods only.
- Markdown headers or bold
- Tool/stack dumping unless tools appear in BOTH job requirements AND candidate data provided
- Invented experience, companies, years, tools, relocation, or visa/work authorization

WRITING STYLE:
- Role and company referenced naturally in the first 1-2 sentences (Gmail preview survival)
- Mention 2-4 matching skills/experiences from provided data only
- Slight natural imperfection OK: uneven paragraph sizes, varied sentence length
- Vary sentence openings; avoid three consecutive "I have" / "I am" starts
- Use tone guidance as style hints, NOT fill-in templates
- Busy-professional tone: direct, grounded, specific, respectful
- As short as possible, as long as necessary for the target word range`;

function buildSystemPrompt(targetWordRange) {
  const min = targetWordRange?.min ?? 120;
  const max = targetWordRange?.max ?? 220;
  return `${SYSTEM_PROMPT_BASE}\n- Target length: approximately ${min}-${max} words (guidance, not a rigid limit)`;
}

const SYSTEM_PROMPT = buildSystemPrompt({ min: 120, max: 220 });

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
  const lines = [
    "Tone guidance (adapt style, do not copy templates):",
    `- Company style: ${toneContext.companyStyle}`,
    `- Communication: ${toneContext.communicationTone}`,
    `- Hiring signal: ${toneContext.hiringSignal}`,
    `- Environment: ${toneContext.environmentType}`,
  ];
  if (toneContext.userToneProfile) {
    lines.push(`- User formality preference: ${toneContext.userToneProfile}`);
  }
  return lines.join("\n");
}

function formatUserToneBlock(toneProfile) {
  const hints = {
    casual: "Warmer, slightly informal phrasing while staying professional. Short sentences OK.",
    balanced: "Friendly professional. Direct, approachable, not stiff.",
    professional: "Concise business tone. Precise, respectful, no slang.",
    executive: "Formal and measured. Authoritative without filler or hype.",
  };
  return `User tone profile (${toneProfile}): ${hints[toneProfile] || hints.balanced}`;
}

function formatEnvelopeBlock(candidate, toneProfile) {
  const senderName = candidate?.name?.trim() || null;
  const salutationByTone = {
    casual: 'Use "Hi," or "Hello," as the salutation (first line).',
    balanced: 'Use "Hi," or "Hello," as the salutation (first line).',
    professional: 'Use "Hello," or "Dear Hiring Team," as the salutation (first line).',
    executive: 'Use "Dear Hiring Manager," or "Dear [Name]," if personalization provides a name.',
  };
  const signoffByTone = {
    casual: 'Use "Thanks," or "Best," as the sign-off line.',
    balanced: 'Use "Best regards," or "Thank you," as the sign-off line.',
    professional: 'Use "Best regards," or "Sincerely," as the sign-off line.',
    executive: 'Use "Sincerely," or "Best regards," as the sign-off line.',
  };

  const lines = [
    "Envelope (fixed for every email; tone affects salutation/sign-off wording only):",
    `- Salutation: ${salutationByTone[toneProfile] || salutationByTone.balanced}`,
    "- Body: middle section only (see structure/length guidance below)",
    `- Sign-off: ${signoffByTone[toneProfile] || signoffByTone.balanced}`,
  ];

  if (senderName) {
    lines.push(`- Sender name: end with exactly "${senderName}" on the last line after the sign-off`);
  } else {
    lines.push("- Sender name: end with the candidate name from provided data on the last line");
  }

  lines.push(
    "Put a blank line after the salutation, between body paragraphs, before the sign-off, and before the sender name."
  );

  return lines.join("\n");
}

function formatStructureBlock(structureMode) {
  const bodyLayouts = {
    conversational:
      "1-2 short body paragraphs between salutation and sign-off. Natural flow.",
    balanced:
      "body paragraphs for: opening hook, fit (2-4 specifics), brief resume mention, one-line CTA.",
    structured:
      "clearly separated body paragraphs: hook, fit evidence, resume mention, CTA (blank line between each).",
    highly_scannable:
      "body: one-line hook, then 2-5 fit lines each starting with - (hyphen bullets only), resume mention, CTA.",
  };
  const layout = bodyLayouts[structureMode] || bodyLayouts.balanced;
  return `Middle body layout (${structureMode}): ${layout} Length/tone sliders control this middle section only.`;
}

function formatLengthGuidance(targetWordRange, seniorityBand) {
  if (!targetWordRange) return "";
  return [
    `Length guidance: aim for ${targetWordRange.min}-${targetWordRange.max} words.`,
    seniorityBand
      ? `Seniority context: ${seniorityBand} — more senior roles may use slightly more evidence; stay within range.`
      : "",
    "Do not pad with generic filler to hit word count.",
  ]
    .filter(Boolean)
    .join("\n");
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
  emailPreferences,
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

  const prefBlocks = [];
  const toneProfile = emailPreferences?.toneProfile || "balanced";
  prefBlocks.push(formatEnvelopeBlock(candidate, toneProfile));
  if (emailPreferences?.toneProfile) {
    prefBlocks.push(formatUserToneBlock(emailPreferences.toneProfile));
  }
  if (emailPreferences?.structureMode) {
    prefBlocks.push(formatStructureBlock(emailPreferences.structureMode));
  }
  if (emailPreferences?.targetWordRange) {
    prefBlocks.push(
      formatLengthGuidance(emailPreferences.targetWordRange, emailPreferences.seniorityBand)
    );
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
    ...prefBlocks,
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
    "Preserve mandatory envelope: salutation line, body paragraphs, sign-off line, sender name on final line.",
  ].join("\n");
}

module.exports = {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildSystemPrompt,
  buildEmailUserPrompt,
  buildRetryUserPrompt,
  formatUserToneBlock,
  formatStructureBlock,
  formatEnvelopeBlock,
};
