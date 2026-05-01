const { computeMatch, normalizeForMatch } = require('../src/services/matchingService');

describe('Matching Service', () => {

  describe('Normalization (normalizeForMatch)', () => {
    it('should lowercase, trim, and deduplicate', () => {
      const input = [" React ", "NODE", "React", "  HTML  "];
      expect(normalizeForMatch(input)).toEqual(["react", "node", "html"]);
    });

    it('should remove dots and replace hyphens', () => {
      const input = ["Node.js", "Front-end", "React.JS", "c++"];
      expect(normalizeForMatch(input)).toEqual(["nodejs", "front end", "reactjs", "c++"]);
    });

    it('should safely handle null, undefined, or invalid arrays', () => {
      expect(normalizeForMatch(null)).toEqual([]);
      expect(normalizeForMatch(undefined)).toEqual([]);
      expect(normalizeForMatch("not an array")).toEqual([]);
      expect(normalizeForMatch([null, "valid", undefined, 123])).toEqual(["valid"]);
    });
  });

  describe('Compute Match Logic', () => {
    it('should return 100% when all JD skills are in Resume', () => {
      const resumeClean = { skills: ["javascript", "react", "nodejs", "html"] };
      const jd = { skills: ["React", "node.js"] };
      
      const result = computeMatch(resumeClean, jd);
      
      expect(result.score).toBe(100);
      expect(result.matchedSkills).toEqual(["nodejs", "react"]); // Alphabetical sort expected
      expect(result.missingSkills).toEqual([]);
      expect(result.meta).toEqual({ totalJdSkills: 2, matchedCount: 2 });
    });

    it('should return 0% when there is no overlap', () => {
      const resume = { skills: ["python", "django"] };
      const jd = { skills: ["react", "node"] };
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(0);
      expect(result.matchedSkills).toEqual([]);
      expect(result.missingSkills).toEqual(["node", "react"]); // sorted
      expect(result.meta).toEqual({ totalJdSkills: 2, matchedCount: 0 });
    });

    it('should calculate partial matches correctly (50%)', () => {
      const resume = { skills: ["javascript", "react"] };
      const jd = { skills: ["react", "typescript"] };
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(50);
      expect(result.matchedSkills).toEqual(["react"]);
      expect(result.missingSkills).toEqual(["typescript"]);
    });

    it('should handle fuzzy matching correctly for strings > 2 chars', () => {
      const resume = { skills: ["reactjs", "node.js developer"] };
      const jd = { skills: ["react", "nodejs"] }; // JD "nodejs" matches "node.js developer" (normalized: "nodejs developer")
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(100);
      expect(result.matchedSkills).toEqual(["nodejs", "react"]);
    });

    it('should enforce EXACT match for short strings (length <= 2)', () => {
      const resume = { skills: ["react", "javascript", "css"] };
      const jd = { skills: ["c", "r", "js"] }; 
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(0);
      expect(result.matchedSkills).toEqual([]);
      expect(result.missingSkills).toEqual(["c", "js", "r"]);
    });

    it('should allow EXACT match for short strings', () => {
      const resume = { skills: ["c", "c++", "go"] };
      const jd = { skills: ["c", "go"] };
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(100);
      expect(result.matchedSkills).toEqual(["c", "go"]);
    });

    it('should return 0 if JD skills are empty', () => {
      const resume = { skills: ["react"] };
      const jd = { skills: [] };
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(0);
      expect(result.meta).toEqual({ totalJdSkills: 0, matchedCount: 0 });
    });

    it('should gracefully handle completely missing/null inputs', () => {
      const result = computeMatch(null, undefined);
      
      expect(result.score).toBe(0);
      expect(result.matchedSkills).toEqual([]);
      expect(result.missingSkills).toEqual([]);
      expect(result.meta).toEqual({ totalJdSkills: 0, matchedCount: 0 });
    });

    it('should ensure each JD skill matches only once (no duplicates generated)', () => {
      // Resume has multiple fuzzy variants of "react"
      const resume = { skills: ["react", "react native", "reactjs"] };
      const jd = { skills: ["react"] };
      
      const result = computeMatch(resume, jd);
      
      expect(result.score).toBe(100);
      expect(result.matchedSkills).toEqual(["react"]); // Only appears once
      expect(result.meta).toEqual({ totalJdSkills: 1, matchedCount: 1 });
    });
  });

});
