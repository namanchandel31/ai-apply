const ROLE_SKILL_MAP = Object.freeze({
  "Flutter Developer": ["Flutter", "Dart"],
  "Node.js Developer": ["Node.js", "JavaScript", "TypeScript"],
  "React Developer": ["React", "JavaScript", "TypeScript"],
  "Python Developer": ["Python"],
  "AI/ML Engineer": ["Python", "Machine Learning"],
  "Data Engineer": ["Python", "SQL", "ETL"],
  "Backend Engineer": ["Node.js", "Python", "SQL"],
  "Frontend Engineer": ["JavaScript", "TypeScript", "React"],
  "Full Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js"],
  "Software Engineer": ["JavaScript", "Python"],
  "Mobile Developer": ["Flutter", "Dart", "React Native"],
  "iOS Developer": ["Swift", "iOS"],
  "Android Developer": ["Kotlin", "Android"],
  "DevOps Engineer": ["Docker", "Kubernetes", "CI/CD"],
  "Product Manager": ["Product Management"],
});

/**
 * @param {string} canonicalRole
 * @returns {string[]}
 */
function skillsForRole(canonicalRole) {
  if (!canonicalRole) return [];
  return [...(ROLE_SKILL_MAP[canonicalRole] || [])];
}

/**
 * @param {string[]} canonicalRoles
 * @returns {string[]}
 */
function skillsForRoles(canonicalRoles) {
  const out = new Set();
  for (const role of canonicalRoles || []) {
    for (const skill of skillsForRole(role)) {
      out.add(skill);
    }
  }
  return [...out];
}

module.exports = {
  ROLE_SKILL_MAP,
  skillsForRole,
  skillsForRoles,
};
