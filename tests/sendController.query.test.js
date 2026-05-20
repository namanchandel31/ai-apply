describe("sendController SQL", () => {
  it("selects application_status not email_status", () => {
    const query = `
      SELECT a.email_subject, a.email_body, a.application_status,
             r.file_path,
             jd.contact_email AS jd_contact_email
       FROM applications a
       JOIN job_descriptions jd ON jd.id = a.job_description_id
       LEFT JOIN resumes r ON r.id = a.resume_id
       WHERE a.id = $1 AND a.user_id = $2`;

    expect(query).toMatch(/a\.application_status/);
    expect(query).not.toMatch(/a\.email_status/);
  });
});
