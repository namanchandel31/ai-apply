const { inferToneContext } = require("./emailToneInference");
const { buildPersonalizationContext } = require("./emailPersonalizationContext");
const {
  resolveEmailPreferences,
  blendToneContext,
  buildGenerationSnapshot,
} = require("./emailPreferenceMapper");

/**
 * Build generation context from parsed JD, resume, match result, and user email prefs.
 */
function buildEmailGenerationContext({
  rawJdText,
  parsedJd,
  resumeParsedJson,
  matchResult,
  emailToneLevel = 50,
  emailStructureLevel = 60,
}) {
  const experience = (resumeParsedJson?.experience || []).slice(0, 3).map((exp) => ({
    company: exp.company,
    role: exp.role,
    description: exp.description
      ? String(exp.description).slice(0, 280)
      : null,
    technologies: (exp.technologies || []).slice(0, 8),
  }));

  const candidate = {
    name: resumeParsedJson?.name || null,
    location: resumeParsedJson?.location || null,
    summary: resumeParsedJson?.summary
      ? String(resumeParsedJson.summary).slice(0, 400)
      : null,
    skills: (resumeParsedJson?.skills || []).slice(0, 30),
    experience,
    projects: (resumeParsedJson?.projects || []).slice(0, 2).map((p) => ({
      name: p.name,
      description: p.description ? String(p.description).slice(0, 200) : null,
    })),
  };

  const job = {
    title: parsedJd?.job_title || null,
    company: parsedJd?.company_name || null,
    location: parsedJd?.location || null,
    jobType: parsedJd?.job_type || null,
    requiredSkills: (parsedJd?.skills || []).slice(0, 25),
    contactEmail: parsedJd?.contact_email || null,
  };

  const match = {
    score: matchResult?.score ?? 0,
    matchedSkills: matchResult?.matchedSkills || [],
    missingSkills: matchResult?.missingSkills || [],
  };

  const jdTone = inferToneContext({ rawJdText: rawJdText || "", parsedJd });
  const emailPrefs = resolveEmailPreferences({
    emailToneLevel,
    emailStructureLevel,
    job,
    candidate,
    resumeParsedJson,
  });
  const toneContext = blendToneContext(jdTone, emailPrefs.toneProfile);

  const { personalizationContext, personalizationUsed } = buildPersonalizationContext({
    rawJdText: rawJdText || "",
    parsedJd,
  });

  const allowedTools = new Set([
    ...match.matchedSkills.map((s) => s.toLowerCase()),
    ...candidate.skills.map((s) => String(s).toLowerCase()),
    ...job.requiredSkills.map((s) => String(s).toLowerCase()),
  ]);

  const generationSnapshot = buildGenerationSnapshot(emailPrefs);

  return {
    candidate,
    job,
    match,
    toneContext,
    toneType: toneContext.toneType,
    emailPreferences: emailPrefs,
    generationSnapshot,
    personalizationContext,
    personalizationUsed,
    allowedTools: [...allowedTools],
    rawJdText: rawJdText || "",
  };
}

module.exports = { buildEmailGenerationContext };
