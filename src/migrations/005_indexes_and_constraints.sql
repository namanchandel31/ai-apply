-- User ownership indexes
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_jd_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_id ON applications(user_id);

-- Composite indexes for ownership queries (id + user_id)
CREATE INDEX IF NOT EXISTS idx_app_id_user ON applications(id, user_id);
CREATE INDEX IF NOT EXISTS idx_resume_id_user ON resumes(id, user_id);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_app_resume_id ON applications(resume_id);
CREATE INDEX IF NOT EXISTS idx_app_jd_id ON applications(job_description_id);
CREATE INDEX IF NOT EXISTS idx_parsed_resume_id ON parsed_resumes(resume_id);
CREATE INDEX IF NOT EXISTS idx_parsed_jd_id ON parsed_job_descriptions(job_description_id);

-- Performance indexes (status column removed in 011b — only create when present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
  END IF;
END $$;
-- Note: file_hash has UNIQUE constraint, no separate index needed

-- JSONB performance indexes
CREATE INDEX IF NOT EXISTS idx_parsed_resume_json ON parsed_resumes USING GIN (parsed_json);
CREATE INDEX IF NOT EXISTS idx_parsed_jd_json ON parsed_job_descriptions USING GIN (parsed_json);

-- Auto-update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at column
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_failed_parses_updated_at ON failed_parses;
CREATE TRIGGER update_failed_parses_updated_at BEFORE UPDATE ON failed_parses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_email_credentials_updated_at ON user_email_credentials;
CREATE TRIGGER update_user_email_credentials_updated_at BEFORE UPDATE ON user_email_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
