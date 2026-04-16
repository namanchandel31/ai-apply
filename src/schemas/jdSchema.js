const { z } = require("zod");

/**
 * Zod schema for a parsed job description.
 * All fields except skills are nullable.
 * job_type is an enum with a fixed set of allowed values.
 */
const JDSchema = z.object({
  job_title: z.string().nullable(),
  company_name: z.string().nullable(),
  contact_person: z.string().nullable(),
  location: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_number: z.string().nullable(),
  job_type: z.enum(["Remote", "Hybrid", "Onsite", "Unknown"]).nullable(),
  skills: z.array(z.string()),
});

module.exports = { JDSchema };
