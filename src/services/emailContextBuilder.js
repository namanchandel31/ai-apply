const { inferToneContext } = require("./emailToneInference");
const { buildPersonalizationContext } = require("./emailPersonalizationContext");

/**
 * Build generation context from parsed JD, resume, and match result.
 */
function buildEmailGenerationContext({ rawJdText, parsedJd, resumeParsedJson, matchResult }) {
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

  const toneContext = inferToneContext({ rawJdText: rawJdText || "", parsedJd });
  const { personalizationContext, personalizationUsed } = buildPersonalizationContext({
    rawJdText: rawJdText || "",
    parsedJd,
  });

  const allowedTools = new Set([
    ...match.matchedSkills.map((s) => s.toLowerCase()),
    ...candidate.skills.map((s) => String(s).toLowerCase()),
    ...job.requiredSkills.map((s) => String(s).toLowerCase()),
  ]);

  return {
    candidate,
    job,
    match,
    toneContext,
    toneType: toneContext.toneType,
    personalizationContext,
    personalizationUsed,
    allowedTools: [...allowedTools],
    rawJdText: rawJdText || "",
  };
}

module.exports = { buildEmailGenerationContext };
