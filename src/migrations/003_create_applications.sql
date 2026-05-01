CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY,
  user_id TEXT NULL,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  match_score INT NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'sent', 'failed')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_application UNIQUE(resume_id, job_description_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_resume_id ON applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_applications_jd_id ON applications(job_description_id);
