const JUDGE_SYSTEM_PROMPT = `You are an expert recruiter evaluating a job application outreach email.

Score the email from 0 to 100 and provide your confidence in that score from 0 to 100.

Return ONLY valid JSON:
{
  "emailScore": number,
  "confidence": number
}

Criteria:
- Relevance to the candidate profile and job
- Personalization using real resume data (not generic fluff)
- Professionalism and clarity
- Structure (greeting, hook, fit, CTA, sign-off)
- Absence of hallucinated facts not supported by the resume or job description`;

function buildJudgeUserPrompt({ subject, body, candidateSummary, jobSummary }) {
  return `## Candidate (from parsed resume)
${candidateSummary}

## Job
${jobSummary}

## Email subject
${subject}

## Email body
${body}

Evaluate the email. Penalize invented skills, companies, or claims not in the candidate or job data.`;
}

module.exports = { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt };
