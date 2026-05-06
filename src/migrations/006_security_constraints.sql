-- Security constraints migration
-- Adds NOT NULL, FK, CHECK constraints and composite indexes

-- Add NOT NULL and FK constraints for user_id columns
ALTER TABLE resumes 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE job_descriptions 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT fk_jd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE applications 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_email_credentials 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT fk_cred_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add basic CHECK constraints
ALTER TABLE user_email_credentials 
  ADD CONSTRAINT chk_email_length CHECK (char_length(email) > 5);

-- Add composite indexes for efficient user_id + id queries
CREATE INDEX idx_resumes_id_user ON resumes(id, user_id);
CREATE INDEX idx_jd_id_user ON job_descriptions(id, user_id);
CREATE INDEX idx_app_id_user ON applications(id, user_id);

-- Add UNIQUE constraint for user_email_credentials
ALTER TABLE user_email_credentials 
  ADD CONSTRAINT unique_user_credentials UNIQUE (user_id);

-- Add idempotency constraint for applications
CREATE UNIQUE INDEX uniq_app_user_resume_jd 
ON applications(user_id, resume_id, job_description_id);
