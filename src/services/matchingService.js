/**
 * Normalize an array of skills specifically for matching purposes.
 * - Extracts array safely
 * - Converts to lowercase and trims
 * - Removes dots (.)
 * - Replaces hyphens (-) with spaces
 * - Deduplicates
 * 
 * @param {string[]} skillsArray
 * @returns {string[]}
 */
const normalizeForMatch = (skillsArray) => {
  if (!Array.isArray(skillsArray)) return [];
  
  const processed = skillsArray
    .filter(s => typeof s === 'string')
    .map(s => 
      s.toLowerCase()
       .trim()
       .replace(/\./g, '')
       .replace(/-/g, ' ')
    )
    .filter(Boolean); // removes empty strings after replace/trim
    
  return [...new Set(processed)];
};

/**
 * Computes a deterministic match score between a parsed resume and JD.
 * Pure function with no side effects.
 * 
 * @param {Object} resumeData - Parsed JSON object from resume
 * @param {Object} jdData - Parsed JSON object from JD
 * @returns {Object} { score, matchedSkills, missingSkills, meta }
 */
const computeMatch = (resumeData, jdData) => {
  const resumeSkills = normalizeForMatch(resumeData?.skills || []);
  const jdSkills = normalizeForMatch(jdData?.skills || []);

  const matchedSkills = [];
  const missingSkills = [];

  for (const jdSkill of jdSkills) {
    let isMatched = false;

    for (const resumeSkill of resumeSkills) {
      // Boundary check: if either string is <= 2 chars, require exact match.
      if (jdSkill.length <= 2 || resumeSkill.length <= 2) {
        if (jdSkill === resumeSkill) {
          isMatched = true;
          break;
        }
      } else {
        // Fuzzy match for longer strings
        if (resumeSkill.includes(jdSkill) || jdSkill.includes(resumeSkill)) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      matchedSkills.push(jdSkill); // retain JD original (normalized) naming
    } else {
      missingSkills.push(jdSkill);
    }
  }

  // Sort alphabetically
  matchedSkills.sort();
  missingSkills.sort();

  const totalJdSkills = jdSkills.length;
  const matchedCount = matchedSkills.length;
  
  const score = totalJdSkills === 0 ? 0 : Math.round((matchedCount / totalJdSkills) * 100);

  return {
    score,
    matchedSkills,
    missingSkills,
    meta: {
      totalJdSkills,
      matchedCount
    }
  };
};

module.exports = {
  computeMatch,
  normalizeForMatch // exported for testing purposes
};
