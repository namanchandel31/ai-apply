const { ResumeSchema } = require("../schemas/resumeSchema");
const { isValidEmail } = require("../utils/validators");
const { roundScore } = require("./certificationScoring");

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGroundedInSource(value, sourceText) {
  if (!value) return false;
  const normSource = normalizeForMatch(sourceText);
  const normValue = normalizeForMatch(value);
  if (!normValue) return false;
  return normSource.includes(normValue);
}

function computeSkillPrecision(skills, sourceText) {
  const list = Array.isArray(skills) ? skills.filter(Boolean) : [];
  if (!list.length) return { precision: 0, skillsFound: 0, skillsTotal: 0 };

  const normSource = normalizeForMatch(sourceText);
  let found = 0;
  for (const skill of list) {
    const normSkill = normalizeForMatch(skill);
    if (normSkill && normSource.includes(normSkill)) found += 1;
  }
  return {
    precision: found / list.length,
    skillsFound: found,
    skillsTotal: list.length,
  };
}

function scoreCompleteness(parsed) {
  let score = 0;
  let max = 0;

  const add = (weight, ok) => {
    max += weight;
    if (ok) score += weight;
  };

  add(10, !!parsed.phone);
  add(10, !!parsed.location);
  add(10, !!parsed.summary && String(parsed.summary).trim().length > 20);
  add(15, Array.isArray(parsed.skills) && parsed.skills.length >= 5);
  add(25, Array.isArray(parsed.experience) && parsed.experience.some((e) => e?.company && e?.role));
  add(20, Array.isArray(parsed.education) && parsed.education.some((e) => e?.institution));
  add(10, Array.isArray(parsed.projects) && parsed.projects.length > 0);

  return max ? roundScore((score / max) * 100) : 0;
}

function scoreRequiredFields(parsed) {
  const hasName = !!parsed.name && String(parsed.name).trim().length > 0;
  const hasEmail = isValidEmail(parsed.email);
  const hasSkills = Array.isArray(parsed.skills) && parsed.skills.length >= 3;
  const count = [hasName, hasEmail, hasSkills].filter(Boolean).length;
  return roundScore((count / 3) * 100);
}

function scoreGrounding(parsed, sourceText) {
  const nameOk = isGroundedInSource(parsed.name, sourceText);
  const emailOk = parsed.email
    ? normalizeForMatch(sourceText).includes(normalizeForMatch(parsed.email))
    : false;
  const { precision, skillsFound, skillsTotal } = computeSkillPrecision(parsed.skills, sourceText);

  const nameScore = nameOk ? 100 : 0;
  const emailScore = emailOk ? 100 : 0;
  const skillScore = roundScore(precision * 100);

  const groundingScore = roundScore(nameScore * 0.3 + emailScore * 0.3 + skillScore * 0.4);

  return {
    score: groundingScore,
    detail: {
      nameGrounded: nameOk,
      emailGrounded: emailOk,
      skillPrecision: precision,
      skillsFound,
      skillsTotal,
    },
  };
}

function scoreResumeParse(parsed, sourceText) {
  const schemaOk = ResumeSchema.safeParse(parsed).success;
  const schemaScore = schemaOk ? 100 : 0;
  const requiredScore = scoreRequiredFields(parsed);
  const completenessScore = scoreCompleteness(parsed);
  const grounding = scoreGrounding(parsed, sourceText);

  const resumeScore = roundScore(
    schemaScore * 0.2 +
      requiredScore * 0.25 +
      completenessScore * 0.3 +
      grounding.score * 0.25
  );

  return {
    resumeScore,
    groundingDetail: grounding.detail,
    schemaOk,
  };
}

module.exports = {
  scoreResumeParse,
  computeSkillPrecision,
  isGroundedInSource,
};
