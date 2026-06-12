const CERTIFICATION_SAMPLE_JD_TEXT = `Senior Software Engineer — Acme Labs
Location: Remote (India) · Full-time

We are hiring a Senior Software Engineer to build scalable backend services and modern web applications.

Requirements:
• 3+ years experience with Node.js and TypeScript
• Strong React and PostgreSQL skills
• Experience with REST APIs and cloud deployment
• Excellent communication and ownership

Nice to have: Redis, BullMQ, LLM integrations

Apply with your resume and a brief note on relevant projects.`;

const CERTIFICATION_PARSED_JD = {
  job_title: "Senior Software Engineer",
  company_name: "Acme Labs",
  location: "Remote (India)",
  job_type: "Full-time",
  skills: [
    "Node.js",
    "TypeScript",
    "React",
    "PostgreSQL",
    "REST APIs",
    "Redis",
    "BullMQ",
  ],
  contact_email: "hiring@acmelabs.example",
};

module.exports = {
  CERTIFICATION_SAMPLE_JD_TEXT,
  CERTIFICATION_PARSED_JD,
};
