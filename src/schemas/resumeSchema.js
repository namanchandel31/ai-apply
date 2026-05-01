const { z } = require("zod");

/**
 * Zod schema for a parsed resume.
 * Strict validation enforcing the structure expected from the LLM.
 */
const ResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  portfolio: z.string().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string().nullable(),
      role: z.string().nullable(),
      location: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      duration: z.string().nullable(),
      description: z.string().nullable(),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string().nullable(),
      degree: z.string().nullable(),
      field_of_study: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string().nullable(),
      description: z.string().nullable(),
      technologies: z.array(z.string()),
    })
  ),
  certifications: z.array(z.string()),
});

module.exports = { ResumeSchema };
