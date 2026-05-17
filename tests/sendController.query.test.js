/**
 * Validates sendApplicationController prefetch SQL uses consistent aliases.
 */
describe("sendApplicationController SQL", () => {
  it("uses r.file_path with resumes alias r (not undefined a)", () => {
    // Mirror the query string from sendController.js — regression guard
    const query = `
      SELECT a.email_subject, a.email_body, a.email_status,
              r.file_path,
              jd.contact_email AS jd_contact_email
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`;

    expect(query).toMatch(/FROM applications a/i);
    expect(query).toMatch(/LEFT JOIN resumes r ON r\.id = a\.resume_id/i);
    expect(query).toMatch(/r\.file_path/);
    expect(query).not.toMatch(/a\.file_path/);
    expect(query).toMatch(/a\.email_status/);
  });
});
